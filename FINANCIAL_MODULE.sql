-- ============================================================
-- MÓDULO FINANCEIRO ESTRATÉGICO
-- Executar no Supabase SQL Editor
-- ============================================================

-- Categorias financeiras
CREATE TABLE IF NOT EXISTS public.financial_categories (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('receita', 'despesa')),
    created_at timestamptz DEFAULT now()
);

-- Centros de custo
CREATE TABLE IF NOT EXISTS public.cost_centers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Lançamentos financeiros
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('receita', 'despesa')),
    category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
    cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
    driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    competence_date date NOT NULL,
    payment_date date,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Contas a pagar
CREATE TABLE IF NOT EXISTS public.accounts_payable (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    due_date date NOT NULL,
    paid_date date,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
    supplier_name text,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Contas a receber
CREATE TABLE IF NOT EXISTS public.accounts_receivable (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    due_date date NOT NULL,
    received_date date,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'overdue', 'cancelled')),
    client_name text,
    trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

-- Policies (acesso apenas pela própria empresa)
CREATE POLICY "company_access" ON public.financial_categories
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.cost_centers
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.financial_transactions
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.accounts_payable
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.accounts_receivable
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Categorias padrão (inserir após criar uma empresa)
-- INSERT INTO financial_categories (company_id, name, type) VALUES
--   (:'company_id', 'Frete', 'receita'),
--   (:'company_id', 'Outros Serviços', 'receita'),
--   (:'company_id', 'Combustível', 'despesa'),
--   (:'company_id', 'Manutenção', 'despesa'),
--   (:'company_id', 'Pneus', 'despesa'),
--   (:'company_id', 'Salários', 'despesa'),
--   (:'company_id', 'Financiamento', 'despesa'),
--   (:'company_id', 'Impostos', 'despesa'),
--   (:'company_id', 'Administrativo', 'despesa');
