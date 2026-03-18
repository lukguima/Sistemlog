-- CORREÇÃO DE PERMISSÕES PARA VEÍCULOS E MOTORISTAS
-- Este script libera a escrita (INSERT/UPDATE/DELETE) nas tabelas vehicles e drivers

-- 1. CORREÇÃO PARA VEÍCULOS (vehicles)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for authenticated" ON public.vehicles;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.vehicles;

CREATE POLICY "Allow all for authenticated"
ON public.vehicles
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 2. CORREÇÃO PARA MOTORISTAS (drivers)
-- Verifica se a tabela existe antes de aplicar
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'drivers') THEN
        ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Allow select for authenticated" ON public.drivers;
        DROP POLICY IF EXISTS "Allow all for authenticated" ON public.drivers;

        EXECUTE 'CREATE POLICY "Allow all for authenticated" ON public.drivers FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')';
    END IF;
END
$$;

-- 3. GARANTIR PERMISSÕES DE GRANT
GRANT ALL ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'drivers') THEN
        GRANT ALL ON public.drivers TO authenticated;
        GRANT ALL ON public.drivers TO service_role;
    END IF;
END
$$;
