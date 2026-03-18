-- SCRIPT DE CORREÇÃO COMPLETO PARA CONFIGURAÇÕES
-- Este script garante que todas as tabelas e colunas necessárias para a página de Configurações existam.

-- 1. TABELA COMPANIES (Perfil da Empresa)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address text;

-- Tornar subdomain opcional para evitar erro de constraint NOT NULL
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='subdomain') THEN
        ALTER TABLE public.companies ALTER COLUMN subdomain DROP NOT NULL;
    END IF;
END $$;

-- 2. TABELA SETTINGS (Branding e Módulos)
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL UNIQUE,
    system_name TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#2563EB',
    modules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA SUBSCRIPTIONS (Assinaturas)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL UNIQUE,
    plan TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. SEGURANÇA (RLS - Row Level Security)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Settings isolation" ON public.settings;
CREATE POLICY "Settings isolation" ON public.settings FOR ALL USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Subscriptions isolation" ON public.subscriptions;
CREATE POLICY "Subscriptions isolation" ON public.subscriptions FOR ALL USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- Garantir permissões básicas
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Notificar o PostgREST para recarregar o esquema
NOTIFY pgrst, 'reload config';
