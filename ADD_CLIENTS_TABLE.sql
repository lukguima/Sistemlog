-- ============================================================
-- CADASTRO DE CLIENTES (frete) + vínculo opcional em viagens
-- Rode no SQL Editor do Supabase antes/ao deploy.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    name text NOT NULL,
    document text,              -- CNPJ/CPF
    phone text,
    email text,
    default_destination text,   -- sugere destino na Nova Viagem
    notes text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_id, name);

-- company_id do JWT (mesma função usada em vehicles/fuel)
CREATE OR REPLACE FUNCTION public.jwt_company_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT auth.jwt() -> 'app_metadata' ->> 'company_id';
$$;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON public.clients;
DROP POLICY IF EXISTS clients_company_isolation ON public.clients;
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

COMMENT ON TABLE public.clients IS 'Clientes de frete da transportadora (não confundir com tenants SaaS)';
COMMENT ON COLUMN public.clients.default_destination IS 'Destino padrão sugerido ao selecionar o cliente na viagem';

-- Vínculo opcional na viagem (não substitui origin/destination)
ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_client_id ON public.trips(client_id);
