-- ============================================================
-- ACESSO DO POSTO — CORREÇÃO DECISIVA (V2)
-- ------------------------------------------------------------
-- Remove TODAS as políticas de vehicles/drivers/fuel_records e
-- recria uma única política limpa, com escopo por empresa via
-- company_id do JWT. Qualquer membro da empresa (admin, operador,
-- frentista) enxerga e opera nos registros da PRÓPRIA empresa.
-- Também mostra quantos veículos a empresa tem (diagnóstico).
-- Idempotente.
-- ============================================================

-- Função auxiliar: company_id do usuário logado (do JWT)
CREATE OR REPLACE FUNCTION public.jwt_company_id()
RETURNS text LANGUAGE sql STABLE AS $$
    SELECT auth.jwt() -> 'app_metadata' ->> 'company_id';
$$;

-- ── VEHICLES ──
DO $$
DECLARE pol record;
BEGIN
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.vehicles', pol.policyname);
    END LOOP;
END $$;
CREATE POLICY company_all ON public.vehicles
    FOR ALL TO authenticated
    USING (company_id::text = public.jwt_company_id())
    WITH CHECK (company_id::text = public.jwt_company_id());

-- ── DRIVERS ──
DO $$
DECLARE pol record;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='drivers') THEN
        ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='drivers' LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.drivers', pol.policyname);
        END LOOP;
        EXECUTE 'CREATE POLICY company_all ON public.drivers FOR ALL TO authenticated '
             || 'USING (company_id::text = public.jwt_company_id()) '
             || 'WITH CHECK (company_id::text = public.jwt_company_id())';
    END IF;
END $$;

-- ── FUEL_RECORDS ──
DO $$
DECLARE pol record;
BEGIN
    ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='fuel_records' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.fuel_records', pol.policyname);
    END LOOP;
END $$;
CREATE POLICY company_all ON public.fuel_records
    FOR ALL TO authenticated
    USING (company_id::text = public.jwt_company_id())
    WITH CHECK (company_id::text = public.jwt_company_id());

-- ── DIAGNÓSTICO: quantos veículos existem por empresa ──
SELECT company_id::text AS empresa, count(*) AS qtd_veiculos
FROM public.vehicles
GROUP BY company_id
ORDER BY qtd_veiculos DESC;
