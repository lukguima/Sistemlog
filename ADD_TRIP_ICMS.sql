-- ============================================================
-- ICMS (R$) em viagens — separado do imposto padrão (%)
-- Rode no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS icms_value numeric DEFAULT 0;

COMMENT ON COLUMN public.trips.icms_value IS 'Valor do ICMS em R$ (não confundir com tax_rate %)';

NOTIFY pgrst, 'reload schema';
