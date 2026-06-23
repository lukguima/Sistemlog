-- Tabela de Agregados (prestadores terceiros de frete)
CREATE TABLE IF NOT EXISTS public.agregados (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    document text,
    phone text,
    email text,
    vehicle_plate text,
    vehicle_model text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes text,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW()
);

-- RLS
ALTER TABLE public.agregados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agregados_company_policy" ON public.agregados
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Colunas na tabela trips para suporte a agregados
ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS driver_type text DEFAULT 'own' CHECK (driver_type IN ('own', 'agregado')),
    ADD COLUMN IF NOT EXISTS agregado_id uuid REFERENCES public.agregados(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS agregado_value numeric DEFAULT 0;

-- Index para buscas por empresa
CREATE INDEX IF NOT EXISTS idx_agregados_company ON public.agregados(company_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_type ON public.trips(driver_type);
