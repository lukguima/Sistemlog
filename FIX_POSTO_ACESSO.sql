-- ============================================================
-- ACESSO DO POSTO (frentista) A VEÍCULOS / MOTORISTAS / ABASTECIMENTO
-- ------------------------------------------------------------
-- O frentista via 0 veículos porque a política ativa de vehicles
-- libera só alguns papéis. Estas políticas são ADITIVAS (permissive):
-- liberam leitura/escrita para QUALQUER membro da empresa
-- (comparando o company_id do JWT), sem remover as políticas
-- existentes do admin. Idempotente.
-- ============================================================

-- Helper de comparação (company_id do veículo == company_id do JWT)
-- Feito inline em cada política para não depender de função extra.

-- ── VEHICLES: leitura por membros da empresa ──
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS posto_company_vehicles ON public.vehicles;
CREATE POLICY posto_company_vehicles ON public.vehicles
  FOR SELECT TO authenticated
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

-- ── DRIVERS: leitura por membros da empresa ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='drivers') THEN
    ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS posto_company_drivers ON public.drivers;
    CREATE POLICY posto_company_drivers ON public.drivers
      FOR SELECT TO authenticated
      USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));
  END IF;
END $$;

-- ── FUEL_RECORDS: frentista lê e insere abastecimentos da empresa ──
ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS posto_company_fuel_select ON public.fuel_records;
CREATE POLICY posto_company_fuel_select ON public.fuel_records
  FOR SELECT TO authenticated
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

DROP POLICY IF EXISTS posto_company_fuel_insert ON public.fuel_records;
CREATE POLICY posto_company_fuel_insert ON public.fuel_records
  FOR INSERT TO authenticated
  WITH CHECK (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

SELECT 'ACESSO DO POSTO LIBERADO' AS resultado;
