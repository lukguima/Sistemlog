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

    SELECT p.diesel_price, p.arla_price
      INTO diesel_price, arla_price
    FROM public.posto_prices p
    WHERE p.company_id = cid;

    IF kind = 'diesel' THEN
        IF diesel_price IS NULL OR diesel_price <= 0 THEN
            RAISE EXCEPTION 'Preço do litro de diesel não definido. Peça ao administrador.';
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
            p_liters, diesel_price, round(p_liters * diesel_price, 2),
            0, 0, 'diesel'
        ) RETURNING id INTO new_id;
    ELSE
        IF arla_price IS NULL OR arla_price <= 0 THEN
            RAISE EXCEPTION 'Preço do litro de ARLA não definido. Peça ao administrador.';
        END IF;
        INSERT INTO public.fuel_records (
            company_id, vehicle_id, driver_id, odometer,
            liters, price_per_liter, total_value,
            arla_liters, arla_value, fuel_type
        ) VALUES (
            cid, p_vehicle_id, p_driver_id, p_odometer,
            0, 0, 0,
            p_liters, round(p_liters * arla_price, 2), 'diesel'
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
