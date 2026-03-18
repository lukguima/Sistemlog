-- ==========================================
-- SCRIPT DE CORREÇÃO DE COLUNAS FALTANTES
-- Execute este script no SQL Editor do Supabase
-- ==========================================

-- 1. CORREÇÃO NA TABELA DE MOTORISTAS (DRIVERS)
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_category text;

-- 2. CORREÇÃO NA TABELA DE MANUTENÇÃO (MAINTENANCE)
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS type text DEFAULT 'preventive';
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS date timestamp with time zone DEFAULT now();
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS km numeric;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS workshop text;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS notes text;

-- Garantir que o tipo da coluna date esteja correto na manutenção
DO $$ 
BEGIN 
    ALTER TABLE public.maintenance ALTER COLUMN date TYPE timestamp with time zone;
EXCEPTION 
    WHEN others THEN NULL; 
END $$;

-- 3. ATUALIZAR CACHE DO SCHEMA
NOTIFY pgrst, 'reload schema';
