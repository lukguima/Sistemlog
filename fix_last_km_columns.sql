-- Adiciona a coluna last_km às tabelas tyres e vehicles
-- Erro reportado: Could not find the 'last_km' column of 'tyres' in the schema cache

DO $$ 
BEGIN
    -- Adiciona last_km na tabela tyres se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tyres' AND column_name = 'last_km') THEN
        ALTER TABLE public.tyres ADD COLUMN last_km numeric DEFAULT 0;
    END IF;

    -- Adiciona last_km na tabela vehicles se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'last_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_km numeric DEFAULT 0;
    END IF;

    -- Adiciona km na tabela tyre_checks se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tyre_checks' AND column_name = 'km') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN km numeric;
    END IF;

    -- Adicionar colunas na trips para o Dashboard
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'cargo_description') THEN
        ALTER TABLE public.trips ADD COLUMN cargo_description text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'origin_city') THEN
        ALTER TABLE public.trips ADD COLUMN origin_city text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'destination_city') THEN
        ALTER TABLE public.trips ADD COLUMN destination_city text;
    END IF;
END $$;

-- Recarrega o cache do PostgREST (Supabase) para reconhecer as novas colunas
NOTIFY pgrst, 'reload schema';
