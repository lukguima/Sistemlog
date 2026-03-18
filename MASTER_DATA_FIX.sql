-- ============================================================
-- SCRIPT DE CORREÇÃO MESTRE - LOGISSAAS V2 (CONSOLIDADO)
-- Execute este script no SQL Editor do Supabase para resolver:
-- 1. Colunas faltantes (last_km, cargo_description, etc.)
-- 2. Vínculo obrigatório com Empresa (Multi-tenancy)
-- 3. Problemas de RLS e Cadastro
-- ============================================================

DO $$ 
BEGIN 
    -- 1. GARANTIR QUE EXISTE UMA EMPRESA PADRÃO
    IF NOT EXISTS (SELECT 1 FROM public.companies LIMIT 1) THEN
        INSERT INTO public.companies (id, name, status)
        VALUES ('00000000-0000-0000-0000-000000000000', 'Empresa Padrão LogiSaaS', 'active');
    END IF;

    -- 2. VINCULAR USUÁRIOS SEM EMPRESA À EMPRESA PADRÃO
    UPDATE public.profiles 
    SET company_id = (SELECT id FROM public.companies LIMIT 1)
    WHERE company_id IS NULL;

    -- 3. ADICIONAR COLUNAS FALTANTES NA TABELA 'trips'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='cargo_description') THEN
        ALTER TABLE public.trips ADD COLUMN cargo_description text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='origin_city') THEN
        ALTER TABLE public.trips ADD COLUMN origin_city text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='destination_city') THEN
        ALTER TABLE public.trips ADD COLUMN destination_city text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='advance_value') THEN
        ALTER TABLE public.trips ADD COLUMN advance_value numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='commission_rate') THEN
        ALTER TABLE public.trips ADD COLUMN commission_rate numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='tax_rate') THEN
        ALTER TABLE public.trips ADD COLUMN tax_rate numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='estimated_cost') THEN
        ALTER TABLE public.trips ADD COLUMN estimated_cost numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='cte_number') THEN
        ALTER TABLE public.trips ADD COLUMN cte_number text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='weight') THEN
        ALTER TABLE public.trips ADD COLUMN weight numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='gross_value') THEN
        ALTER TABLE public.trips ADD COLUMN gross_value numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='origin') THEN
        ALTER TABLE public.trips ADD COLUMN origin text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trips' AND column_name='destination') THEN
        ALTER TABLE public.trips ADD COLUMN destination text;
    END IF;

    -- 4. ADICIONAR COLUNAS FALTANTES NA TABELA 'tyres' E 'vehicles'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyres' AND column_name='last_km') THEN
        ALTER TABLE public.tyres ADD COLUMN last_km numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='last_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_km numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tyre_checks' AND column_name='km') THEN
        ALTER TABLE public.tyre_checks ADD COLUMN km numeric;
    END IF;

    -- 5. COLUNAS DE FINANÇAS E MANUTENÇÃO (LOGICA CONDICIONAL)
    -- maintenance
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance' AND column_name='company_id') THEN
        ALTER TABLE public.maintenance ADD COLUMN company_id uuid REFERENCES public.companies(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance' AND column_name='km') THEN
        ALTER TABLE public.maintenance ADD COLUMN km numeric;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='maintenance' AND column_name='cost') THEN
        ALTER TABLE public.maintenance ADD COLUMN cost numeric DEFAULT 0;
    END IF;

    -- fuel_records
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fuel_records' AND column_name='company_id') THEN
        ALTER TABLE public.fuel_records ADD COLUMN company_id uuid REFERENCES public.companies(id);
    -- 6. CORRIGIR CONSTRAINT DE STATUS DE VIAGENS
    ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_status_check;
    ALTER TABLE public.trips ADD CONSTRAINT trips_status_check 
    CHECK (status IN ('pending', 'in_transit', 'completed', 'validated', 'paid', 'Concluído', 'Em Trânsito', 'Pendente'));

END $$;

-- 5. GARANTIR TABELA DE ADIANTAMENTOS
CREATE TABLE IF NOT EXISTS public.driver_advances (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    description text,
    date timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now()
);

-- Garantir coluna company_id caso a tabela já exista
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='driver_advances' AND column_name='company_id') THEN
        ALTER TABLE public.driver_advances ADD COLUMN company_id uuid REFERENCES public.companies(id);
    END IF;
END $$;

-- 6. CORRIGIR GATILHO DE NOVO USUÁRIO (EVITAR ERROS 500 NO SIGNUP)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $trigger$
DECLARE
    default_company_id uuid;
BEGIN
  SELECT id INTO default_company_id FROM public.companies LIMIT 1;
  
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, company_id)
  VALUES (
      new.id, 
      new.email, 
      COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário Novo'), 
      new.raw_user_meta_data->>'avatar_url',
      COALESCE(new.raw_user_meta_data->>'role', 'admin'),
      default_company_id
  );
  RETURN new;
END;
$trigger$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RECARREGAR CACHE E PERMISSÕES
NOTIFY pgrst, 'reload schema';

-- 7. GARANTIR QUE RLS ESTÁ "ABERTO" PARA DESENVOLVIMENTO (OPCIONAL MAS RECOMENDADO AGORA)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('profiles', 'vehicles', 'drivers', 'trips', 'maintenance', 'fuel_records', 'driver_advances', 'settings', 'tyres', 'tyre_checks', 'companies')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Allow all" ON public.%1$I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;
