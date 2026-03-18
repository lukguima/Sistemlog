-- 1. Garantir que a empresa com o ID que você está usando existe
INSERT INTO public.companies (id, name, subdomain)
VALUES ('f889d593-868c-477d-b6a7-425c2e98ed84', 'Minha Empresa Principal', 'admin')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    subdomain = EXCLUDED.subdomain;

-- 2. Garantir que seu perfil está vinculado a este ID correto
UPDATE public.profiles 
SET company_id = 'f889d593-868c-477d-b6a7-425c2e98ed84';

-- 3. Corrigir registros órfãos para apontarem para este ID
UPDATE public.vehicles SET company_id = 'f889d593-868c-477d-b6a7-425c2e98ed84';
UPDATE public.drivers SET company_id = 'f889d593-868c-477d-b6a7-425c2e98ed84';
UPDATE public.maintenance SET company_id = 'f889d593-868c-477d-b6a7-425c2e98ed84';


-- 4. Atualizar cache
NOTIFY pgrst, 'reload schema';
