-- ============================================================
-- SCRIPT DE CORREÇÃO DE COLUNAS - VEÍCULOS E VIAGENS
-- Execute este script no SQL Editor do Supabase
-- ============================================================

DO $$ 
BEGIN 
    -- 1. CORREÇÕES NA TABELA 'vehicles'
    -- Colunas de Classificação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='truck_type') THEN
        ALTER TABLE public.vehicles ADD COLUMN truck_type text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='axle_count') THEN
        ALTER TABLE public.vehicles ADD COLUMN axle_count integer DEFAULT 2;
    END IF;

    -- Colunas de Intervalos de Manutenção
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='maint_oil_interval') THEN
        ALTER TABLE public.vehicles ADD COLUMN maint_oil_interval integer DEFAULT 15000;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='maint_filter_interval') THEN
        ALTER TABLE public.vehicles ADD COLUMN maint_filter_interval integer DEFAULT 30000;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='maint_tyre_interval') THEN
        ALTER TABLE public.vehicles ADD COLUMN maint_tyre_interval integer DEFAULT 60000;
    END IF;

    -- Colunas de Histórico de Última Troca
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='last_oil_change_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_oil_change_km integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='last_filter_change_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_filter_change_km integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='last_tyre_change_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_tyre_change_km integer DEFAULT 0;
    END IF;

    -- 2. CORREÇÕES NA TABELA 'trips'
    -- Colunas de KM
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='start_km') THEN
        ALTER TABLE public.trips ADD COLUMN start_km numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='end_km') THEN
        ALTER TABLE public.trips ADD COLUMN end_km numeric;
    END IF;

    -- Outras colunas financeiras e de identificação (Garantia)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='cargo_description') THEN
        ALTER TABLE public.trips ADD COLUMN cargo_description text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='cte_number') THEN
        ALTER TABLE public.trips ADD COLUMN cte_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='gross_value') THEN
        ALTER TABLE public.trips ADD COLUMN gross_value numeric DEFAULT 0;
    END IF;
END $$;

-- 3. ATUALIZAR CONSTRAINTS
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_status_check 
CHECK (status IN ('active', 'inactive', 'maintenance', 'in_trip', 'Ativo', 'Inativo', 'Manutenção', 'Em Viagem'));

-- RECARREGAR CACHE DO POSTGREST (Importante para o erro PGRST204)
NOTIFY pgrst, 'reload schema';
