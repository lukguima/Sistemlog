-- Migração para adicionar colunas de classificação e manutenção na tabela vehicles

DO $$ 
BEGIN 
    -- Adiciona coluna truck_type se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='truck_type') THEN
        ALTER TABLE public.vehicles ADD COLUMN truck_type text;
    END IF;

    -- Adiciona coluna axle_count se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='axle_count') THEN
        ALTER TABLE public.vehicles ADD COLUMN axle_count integer;
    END IF;

    -- Adiciona colunas de intervalos de manutenção se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='maint_oil_interval') THEN
        ALTER TABLE public.vehicles ADD COLUMN maint_oil_interval integer DEFAULT 15000;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='maint_filter_interval') THEN
        ALTER TABLE public.vehicles ADD COLUMN maint_filter_interval integer DEFAULT 30000;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='maint_tyre_interval') THEN
        ALTER TABLE public.vehicles ADD COLUMN maint_tyre_interval integer DEFAULT 60000;
    END IF;

    -- Adiciona colunas de última manutenção se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='last_oil_change_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_oil_change_km integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='last_filter_change_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_filter_change_km integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='last_tyre_change_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_tyre_change_km integer DEFAULT 0;
    END IF;

END $$;
