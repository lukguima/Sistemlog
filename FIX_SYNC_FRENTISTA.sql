-- ============================================================
-- FORÇA a sincronização do frentista (profile -> app_metadata)
-- ------------------------------------------------------------
-- O login monta o JWT a partir de auth.users.raw_app_meta_data.
-- O relink anterior mudou só profiles; este script empurra a
-- empresa/role/permissões corretas para o app_metadata, que é
-- o que o login realmente usa.
-- Idempotente.
-- ============================================================

-- 1. Garante o profile do frentista na empresa do admin
UPDATE public.profiles
SET company_id = (
    SELECT company_id FROM public.profiles
    WHERE email = 'vmtransportesrodoviarios@gmail.com' LIMIT 1
)
WHERE email = 'posto.teste@gmail.com';

-- 2. FORÇA o app_metadata a refletir o profile (isto é o que o login lê)
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
        'company_id',  p.company_id::text,
        'role',        p.role,
        'permissions', COALESCE(p.permissions, '[]'::jsonb)
    )
FROM public.profiles p
WHERE p.id = u.id
  AND p.email = 'posto.teste@gmail.com';

-- 3. DIAGNÓSTICO: compara profile vs JWT para os dois usuários
SELECT p.email,
       p.role,
       p.company_id::text                      AS profile_company,
       u.raw_app_meta_data->>'company_id'      AS jwt_company
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email IN ('posto.teste@gmail.com', 'vmtransportesrodoviarios@gmail.com');
