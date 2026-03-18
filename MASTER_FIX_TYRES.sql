-- MESTRE: Sincronização Total de Pneus e Correção de Erros
-- Executar este script no SQL Editor do Supabase

DO $$ 
BEGIN 
    -- 1. ADICIONAR COLUNAS FALTANTES NA TABELA 'tyres'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyres' AND column_name='brand') THEN
        ALTER TABLE public.tyres ADD COLUMN brand text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyres' AND column_name='serial_number') THEN
        ALTER TABLE public.tyres ADD COLUMN serial_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyres' AND column_name='tread_depth_mm') THEN
        ALTER TABLE public.tyres ADD COLUMN tread_depth_mm numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyres' AND column_name='install_date') THEN
        ALTER TABLE public.tyres ADD COLUMN install_date timestamp with time zone DEFAULT now();
    END IF;

    -- 2. ADICIONAR COLUNAS FALTANTES NA TABELA 'tyre_checks'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='tyre_id') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN tyre_id uuid REFERENCES public.tyres(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='depth_mm') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN depth_mm numeric;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='type') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN type text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='notes') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN notes text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='vehicle_id') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='position') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN position text;
    END IF;

    -- 3. REMOVER RESTRIÇÕES DE CHAVE ESTRANGEIRA DE 'company_id' (EVITAR ERROS DE PERMISSÃO)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tyres_company_id_fkey') THEN
        ALTER TABLE public.tyres DROP CONSTRAINT tyres_company_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tyre_checks_company_id_fkey') THEN
        ALTER TABLE public.tyre_checks DROP CONSTRAINT tyre_checks_company_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vehicles_company_id_fkey') THEN
        ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_company_id_fkey;
    END IF;

END $$;
