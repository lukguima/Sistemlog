-- ============================================================
-- SCRIPT PARA CRIAÇÃO DA TABELA DE FECHAMENTOS (SETTLEMENTS)
-- ============================================================

-- Remover se já existir para garantir que a estrutura seja a mais recente
DROP TABLE IF EXISTS public.settlements CASCADE;

CREATE TABLE public.settlements (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
    total_gross numeric DEFAULT 0,
    total_trip_discounts numeric DEFAULT 0, 
    total_advances_applied numeric DEFAULT 0,
    net_paid numeric DEFAULT 0,
    settlement_date timestamp with time zone DEFAULT now(),
    trips_ids uuid[] DEFAULT '{}',
    advances_ids uuid[] DEFAULT '{}',
    status text DEFAULT 'paid',
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Política simples (como as outras)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all" ON public.settlements;
    CREATE POLICY "Allow all" ON public.settlements FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
