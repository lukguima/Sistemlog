-- Migração para suporte completo ao CRUD de Pneus

DO $$ 
BEGIN 
    -- Adiciona colunas detalhadas na tabela tyres se não existirem
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

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyres' AND column_name='status') THEN
        ALTER TABLE public.tyres ADD COLUMN status text DEFAULT 'good';
    END IF;

    -- Garantir que tyre_checks tenha campos para histórico detalhado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='type') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN type text; -- 'check', 'install', 'rotation'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='notes') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN notes text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='depth_mm') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN depth_mm numeric;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='vehicle_id') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='position') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN position text;
    END IF;

END $$;
