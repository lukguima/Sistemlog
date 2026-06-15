-- ============================================================
-- MÓDULO DE FINANCIAMENTOS
-- Executar no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.financings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
    description text NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    down_payment numeric(12,2) DEFAULT 0,
    interest_rate numeric(8,4) DEFAULT 0,
    installments integer NOT NULL,
    installment_value numeric(12,2) NOT NULL,
    start_date date NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'cancelled')),
    bank_name text,
    notes text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financing_installments (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    financing_id uuid REFERENCES public.financings(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    number integer NOT NULL,
    due_date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    paid_date date,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.financings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financing_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_access" ON public.financings
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.financing_installments
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
