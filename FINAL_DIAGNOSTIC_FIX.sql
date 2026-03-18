-- 1. Resolve conflitos de subdomínio
-- Se houver outra empresa usando 'admin', vamos mudar o dela para 'backup-admin'
-- Isso evita o erro: duplicate key value violates unique constraint "companies_subdomain_key"
UPDATE public.companies 
SET subdomain = 'admin-' || substr(id::text, 1, 4)
WHERE subdomain = 'admin' 
AND id != 'f889d593-868c-477d-b6a7-425c2e98ed84';

-- 2. Agora insere ou atualiza a empresa correta com o subdomínio 'admin'
INSERT INTO public.companies (id, name, subdomain)
VALUES ('f889d593-868c-477d-b6a7-425c2e98ed84', 'Minha Empresa Principal', 'admin')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    subdomain = EXCLUDED.subdomain;

-- 3. Vincula seu usuário e todos os dados a este ID correto
UPDATE public.profiles SET company_id = 'f889d593-868c-477d-b6a7-425c2e98ed84';
UPDATE public.vehicles SET company_id = 'f889d593-868c-477d-b6a7-425c2e98ed84';
UPDATE public.drivers SET company_id = 'f889d593-868c-477d-b6a7-425c2e98ed84';

-- 4. Notifica o Supabase para carregar o schema
NOTIFY pgrst, 'reload schema';

-- 5. VERIFICAÇÃO FINAL
SELECT 'SUCESSO!' as status, * FROM public.companies WHERE id = 'f889d593-868c-477d-b6a7-425c2e98ed84';
