-- ============================================================
-- Custos de Carregamento e Descarga na viagem
-- Rode no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS loading_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unloading_cost numeric DEFAULT 0;

COMMENT ON COLUMN public.trips.loading_cost IS 'Custo de carregamento (R$)';
COMMENT ON COLUMN public.trips.unloading_cost IS 'Custo de descarga (R$)';

NOTIFY pgrst, 'reload schema';
