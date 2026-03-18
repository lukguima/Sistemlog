-- ============================================================
-- SCRIPT PARA CRIAÇÃO DA TABELA DE FORNECEDORES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    name text NOT NULL,
    category text, -- 'Peças', 'Combustível', 'Oficina', 'Outros'
    document text, -- CNPJ/CPF
    phone text,
    email text,
    address text,
    city text,
    state text,
    status text DEFAULT 'active',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Política de Acesso (Simplificada para manter padrão atual)
DROP POLICY IF EXISTS "Allow all" ON public.suppliers;
CREATE POLICY "Allow all" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

-- Comentários para documentação
COMMENT ON COLUMN public.suppliers.category IS 'Categoria do fornecedor: Peças, Combustível, Oficina, etc';
