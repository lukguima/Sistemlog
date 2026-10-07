-- ============================================================
-- Posto: data do abastecimento e fornecedor do pátio.
-- Idempotente. Rodar no SQL Editor do Supabase.
-- ============================================================

DROP FUNCTION IF EXISTS public.posto_register_fuel(uuid, uuid, numeric, numeric, text);

CREATE OR REPLACE FUNCTION public.posto_register_fuel(
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_odometer numeric,
    p_liters numeric,
    p_kind text,
    p_date date DEFAULT NULL
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
    patio_id uuid;
    filled_at timestamptz;
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

    filled_at := CASE
        WHEN p_date IS NULL THEN now()
        ELSE (p_date::timestamp + interval '12 hours') AT TIME ZONE 'UTC'
    END;

    SELECT s.id INTO patio_id
    FROM public.suppliers s
    WHERE s.company_id = cid
      AND lower(s.name) = lower('PATIO - TERCEIRO - MARIALVA')
    ORDER BY s.created_at
    LIMIT 1;

    IF patio_id IS NULL THEN
        INSERT INTO public.suppliers (company_id, name, category, status)
        VALUES (cid, 'PATIO - TERCEIRO - MARIALVA', 'Combustível', 'active')
        RETURNING id INTO patio_id;
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
            company_id, vehicle_id, driver_id, supplier_id, odometer,
            liters, price_per_liter, total_value,
            arla_liters, arla_value, fuel_type, created_at
        ) VALUES (
            cid, p_vehicle_id, p_driver_id, patio_id, p_odometer,
            p_liters, liter_price, round(p_liters * liter_price, 2),
            0, 0, 'diesel', filled_at
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
            company_id, vehicle_id, driver_id, supplier_id, odometer,
            liters, price_per_liter, total_value,
            arla_liters, arla_value, fuel_type, created_at
        ) VALUES (
            cid, p_vehicle_id, p_driver_id, patio_id, p_odometer,
            0, 0, 0,
            p_liters, round(p_liters * liter_price, 2), 'diesel', filled_at
        ) RETURNING id INTO new_id;
    END IF;

    RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.posto_register_fuel(uuid, uuid, numeric, numeric, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.posto_register_fuel(uuid, uuid, numeric, numeric, text, date) TO authenticated;

-- Lançamentos já gravados sem fornecedor passam para o pátio.
INSERT INTO public.suppliers (company_id, name, category, status)
SELECT DISTINCT f.company_id, 'PATIO - TERCEIRO - MARIALVA', 'Combustível', 'active'
FROM public.fuel_records f
WHERE f.supplier_id IS NULL
  AND f.company_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.company_id = f.company_id
        AND lower(s.name) = lower('PATIO - TERCEIRO - MARIALVA')
  );

UPDATE public.fuel_records f
SET supplier_id = s.id
FROM public.suppliers s
WHERE f.supplier_id IS NULL
  AND s.company_id = f.company_id
  AND lower(s.name) = lower('PATIO - TERCEIRO - MARIALVA');

NOTIFY pgrst, 'reload schema';
