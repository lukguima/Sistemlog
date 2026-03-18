-- 1. Cria uma empresa padrão com os campos obrigatórios identificados
-- O erro mostrou que 'subdomain' é obrigatório.
INSERT INTO public.companies (id, name, subdomain)
VALUES ('00000000-0000-0000-0000-000000000000', 'Minha Empresa Padrão', 'admin')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    subdomain = EXCLUDED.subdomain;

-- 2. Conecta todos os perfis de usuários a essa empresa padrão caso eles não tenham empresa
UPDATE public.profiles
SET company_id = '00000000-0000-0000-0000-000000000000'
WHERE company_id IS NULL;

-- 3. Caso a tabela 'companies' tenha outros campos obrigatórios que causem erro,
-- você pode rodar o comando abaixo para desativar temporariamente a restrição de NOT NULL (opcional/avançado)
-- ALTER TABLE public.companies ALTER COLUMN subdomain DROP NOT NULL;

