-- Script para adicionar colunas faltantes identificadas por inconsistência entre scripts de schema
-- Tabelas afetadas: fuel_records, maintenance

-- 1. CORREÇÃO NA TABELA fuel_records
-- Add missing columns to fuel_records
ALTER TABLE public.fuel_records
ADD COLUMN IF NOT EXISTS fuel_type text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS price_per_liter numeric;

-- Ensure km_reading exists (as it seems the database expects it)
-- If odometer exists but km_reading doesn't, rename it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_records' AND column_name = 'odometer')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_records' AND column_name = 'km_reading') THEN
        ALTER TABLE public.fuel_records RENAME COLUMN odometer TO km_reading;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fuel_records' AND column_name = 'km_reading') THEN
        ALTER TABLE public.fuel_records ADD COLUMN km_reading numeric DEFAULT 0;
    END IF;
END $$;

-- Optional: ensure km_reading is NOT NULL if that's the desired state,
-- but we must ensure it has values first.
-- ALTER TABLE public.fuel_records ALTER COLUMN km_reading SET NOT NULL;


-- 2. CORREÇÃO NA TABELA maintenance
-- Repair maintenance table
ALTER TABLE public.maintenance
ADD COLUMN IF NOT EXISTS workshop text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS km numeric;

-- 3. NOTIFICAÇÃO DE CONCLUSÃO (OPCIONAL)
-- Este script é seguro para ser rodado múltiplas vezes (idempotente)
