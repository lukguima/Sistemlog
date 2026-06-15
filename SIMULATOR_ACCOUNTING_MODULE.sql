-- ============================================================
-- MÓDULO SIMULADOR + CENTRAL CONTÁBIL
-- Executar no Supabase SQL Editor
-- ============================================================

-- Simulações de investimento
CREATE TABLE IF NOT EXISTS public.investment_simulations (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    type text NOT NULL, -- 'truck' | 'driver' | 'freight' | 'fleet_expansion'
    title text NOT NULL,
    params jsonb NOT NULL DEFAULT '{}',
    result jsonb NOT NULL DEFAULT '{}',
    recommendation text,
    saved boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Documentos contábeis
CREATE TABLE IF NOT EXISTS public.accounting_documents (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    type text NOT NULL, -- 'nf', 'boleto', 'contrato', 'declaracao', 'outro'
    description text NOT NULL,
    period text, -- 'YYYY-MM'
    due_date date,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'validated', 'paid', 'rejected')),
    observations text,
    accountant_note text,
    created_at timestamptz DEFAULT now()
);

-- Obrigações fiscais
CREATE TABLE IF NOT EXISTS public.tax_obligations (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL, -- Ex: DAS, DCTF, SPED
    description text,
    due_date date NOT NULL,
    amount numeric(12,2),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_date date,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Eventos de negócio (para IA e memória)
CREATE TABLE IF NOT EXISTS public.business_events (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    type text DEFAULT 'general', -- 'decision', 'alert', 'milestone', 'atypical', 'note'
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.investment_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_access" ON public.investment_simulations
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.accounting_documents
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.tax_obligations
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.business_events
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
