-- ============================================================
-- FIX: RLS da tabela clients (remove "Allow all")
-- ------------------------------------------------------------
-- Isola clientes por empresa via company_id do JWT (app_metadata).
-- Master continua com acesso total (suporte SaaS).
-- Idempotente — pode rodar mesmo se ADD_CLIENTS_TABLE já foi aplicado.
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- Função auxiliar (mesma do posto / outras tabelas)
CREATE OR REPLACE FUNCTION public.jwt_company_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT auth.jwt() -> 'app_metadata' ->> 'company_id';
$$;

-- Garante tabela (no-op se já existir)
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    name text NOT NULL,
    document text,
    phone text,
    email text,
    default_destination text,
    notes text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_id, name);

ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_client_id ON public.trips(client_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Remove qualquer política antiga (incluindo "Allow all")
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'clients'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.clients', pol.policyname);
    END LOOP;
END $$;

-- Empresa própria OU master
CREATE POLICY clients_company_isolation ON public.clients
    FOR ALL
    TO authenticated
    USING (
        company_id::text = public.jwt_company_id()
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    )
    WITH CHECK (
        company_id::text = public.jwt_company_id()
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    );

-- Diagnóstico rápido
SELECT
    COUNT(*) AS total_clientes,
    COUNT(DISTINCT company_id) AS empresas
FROM public.clients;
