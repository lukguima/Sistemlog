-- ============================================================
-- Base da comissão no acerto (por empresa)
-- gross | net_tax (default) | net_all
-- Rode no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS commission_base text DEFAULT 'net_tax';

COMMENT ON COLUMN public.settings.commission_base IS
  'Base da comissão do motorista: gross | net_tax | net_all';

NOTIFY pgrst, 'reload schema';
