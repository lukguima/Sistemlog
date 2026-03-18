-- Resolução de Erro de Chave Estrangeira (company_id) em Pneus

-- Este script remove a restrição de chave estrangeira que está impedindo o salvamento
-- quando o company_id do usuário não existe na tabela de empresas (ou a tabela de empresas está vazia).

DO $$ 
BEGIN 
    -- Remover a FK da tabela tyres se existir
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tyres_company_id_fkey') THEN
        ALTER TABLE public.tyres DROP CONSTRAINT tyres_company_id_fkey;
    END IF;

    -- Remover a FK da tabela tyre_checks se existir
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tyre_checks_company_id_fkey') THEN
        ALTER TABLE public.tyre_checks DROP CONSTRAINT tyre_checks_company_id_fkey;
    END IF;

    -- Remover a FK da tabela vehicles se existir (evitar erros futuros)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vehicles_company_id_fkey') THEN
        ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_company_id_fkey;
    END IF;

END $$;
