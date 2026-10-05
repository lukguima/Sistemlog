-- ============================================================
-- Agregados no abastecimento, preço do litro do posto e frete fixo opcional.
-- Idempotente. Rodar no SQL Editor do Supabase.
-- Não apaga abastecimentos, viagens nem a frota própria.
-- ============================================================

-- 1. Veículo-espelho do agregado (fuel_records exige vehicle_id)
ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS agregado_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'vehicles_agregado_id_fkey'
    ) THEN
        ALTER TABLE public.vehicles
            ADD CONSTRAINT vehicles_agregado_id_fkey
            FOREIGN KEY (agregado_id) REFERENCES public.agregados(id) ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_agregado_id_unique
    ON public.vehicles (agregado_id)
    WHERE agregado_id IS NOT NULL;

-- 2. Preço do litro — só admin/master lê e grava
CREATE TABLE IF NOT EXISTS public.posto_prices (
    company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    diesel_price numeric,
    arla_price numeric,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.posto_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posto_prices_admin ON public.posto_prices;
CREATE POLICY posto_prices_admin ON public.posto_prices
    FOR ALL TO authenticated
    USING (
        company_id::text = COALESCE(auth.jwt() -> 'app_metadata' ->> 'company_id', '')
        AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
    )
    WITH CHECK (
        company_id::text = COALESCE(auth.jwt() -> 'app_metadata' ->> 'company_id', '')
        AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posto_prices TO authenticated;

ALTER TABLE public.posto_prices ADD COLUMN IF NOT EXISTS agregado_diesel_price numeric;
ALTER TABLE public.posto_prices ADD COLUMN IF NOT EXISTS agregado_arla_price numeric;

-- Colunas de ARLA usadas pelo lançamento do posto
ALTER TABLE public.fuel_records ADD COLUMN IF NOT EXISTS arla_liters numeric;
ALTER TABLE public.fuel_records ADD COLUMN IF NOT EXISTS arla_value numeric;

-- 3. Lançamento do frentista: o preço fica no banco e não volta na resposta
CREATE OR REPLACE FUNCTION public.posto_register_fuel(
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_odometer numeric,
    p_liters numeric,
    p_kind text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cid uuid;
    diesel_price numeric;
    arla_price numeric;
    agregado_diesel_price numeric;
    agregado_arla_price numeric;
    is_agregado boolean := false;
    liter_price numeric;
    new_id uuid;
    kind text := lower(trim(COALESCE(p_kind, '')));
BEGIN
    cid := NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::uuid;
    IF cid IS NULL THEN
        RAISE EXCEPTION 'Empresa não identificada.';
    END IF;

    IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') NOT IN ('frentista', 'admin', 'master') THEN
        RAISE EXCEPTION 'Sem permissão para lançar abastecimento.';
    END IF;

    BEGIN
        IF NOT public.company_can_write(cid) THEN
            RAISE EXCEPTION 'Assinatura bloqueada para novos lançamentos.';
        END IF;
    EXCEPTION
        WHEN undefined_function THEN
            NULL;
    END;

    IF p_vehicle_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicle_id AND v.company_id = cid
    ) THEN
        RAISE EXCEPTION 'Veículo não encontrado nesta empresa.';
    END IF;

    IF p_driver_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.drivers d WHERE d.id = p_driver_id AND d.company_id = cid
    ) THEN
        RAISE EXCEPTION 'Motorista não encontrado nesta empresa.';
    END IF;

    IF p_odometer IS NULL OR p_odometer < 0 THEN
        RAISE EXCEPTION 'Informe o odômetro.';
    END IF;

    IF p_liters IS NULL OR p_liters <= 0 THEN
        RAISE EXCEPTION 'Informe os litros.';
    END IF;

    IF kind NOT IN ('diesel', 'arla') THEN
        RAISE EXCEPTION 'Selecione diesel ou ARLA.';
    END IF;

    SELECT p.diesel_price, p.arla_price, p.agregado_diesel_price, p.agregado_arla_price
      INTO diesel_price, arla_price, agregado_diesel_price, agregado_arla_price
    FROM public.posto_prices p
    WHERE p.company_id = cid;

    BEGIN
        EXECUTE $q$
            SELECT (agregado_id IS NOT NULL) OR COALESCE(brand, '') LIKE 'agregado:%'
            FROM public.vehicles WHERE id = $1
        $q$ INTO is_agregado USING p_vehicle_id;
    EXCEPTION
        WHEN undefined_column THEN
            SELECT COALESCE(brand, '') LIKE 'agregado:%'
              INTO is_agregado
            FROM public.vehicles
            WHERE id = p_vehicle_id;
    END;

    IF kind = 'diesel' THEN
        liter_price := CASE WHEN is_agregado THEN agregado_diesel_price ELSE diesel_price END;
        IF liter_price IS NULL OR liter_price <= 0 THEN
            IF is_agregado THEN
                RAISE EXCEPTION 'Preço do litro de diesel para agregados não definido. Peça ao administrador.';
            END IF;
            RAISE EXCEPTION 'Preço do litro de diesel da frota não definido. Peça ao administrador.';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.fuel_records f
            WHERE f.vehicle_id = p_vehicle_id
              AND f.company_id = cid
              AND f.odometer = p_odometer
              AND COALESCE(f.liters, 0) > 0
        ) THEN
            RAISE EXCEPTION 'Já existe um abastecimento deste veículo com este hodômetro.';
        END IF;
        INSERT INTO public.fuel_records (
            company_id, vehicle_id, driver_id, odometer,
            liters, price_per_liter, total_value,
            arla_liters, arla_value, fuel_type
        ) VALUES (
            cid, p_vehicle_id, p_driver_id, p_odometer,
            p_liters, liter_price, round(p_liters * liter_price, 2),
            0, 0, 'diesel'
        ) RETURNING id INTO new_id;
    ELSE
        liter_price := CASE WHEN is_agregado THEN agregado_arla_price ELSE arla_price END;
        IF liter_price IS NULL OR liter_price <= 0 THEN
            IF is_agregado THEN
                RAISE EXCEPTION 'Preço do litro de ARLA para agregados não definido. Peça ao administrador.';
            END IF;
            RAISE EXCEPTION 'Preço do litro de ARLA da frota não definido. Peça ao administrador.';
        END IF;
        INSERT INTO public.fuel_records (
            company_id, vehicle_id, driver_id, odometer,
            liters, price_per_liter, total_value,
            arla_liters, arla_value, fuel_type
        ) VALUES (
            cid, p_vehicle_id, p_driver_id, p_odometer,
            0, 0, 0,
            p_liters, round(p_liters * liter_price, 2), 'diesel'
        ) RETURNING id INTO new_id;
    END IF;

    RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.posto_register_fuel(uuid, uuid, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.posto_register_fuel(uuid, uuid, numeric, numeric, text) TO authenticated;

-- 4. Valor do trecho fixo pode ficar vazio
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'fixed_routes' AND column_name = 'freight_value'
    ) THEN
        ALTER TABLE public.fixed_routes ALTER COLUMN freight_value DROP NOT NULL;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
