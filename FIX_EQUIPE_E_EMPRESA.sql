-- ============================================================
-- CORRIGE (1) empresa do frentista e (2) lista da Equipe
-- ------------------------------------------------------------
-- 1) Move o frentista para a MESMA empresa do admin.
-- 2) Cria política que deixa cada usuário VER todos os perfis
--    da própria empresa (a Equipe passa a listar todo mundo).
-- Idempotente.
-- ============================================================

-- 1. Relink do frentista para a empresa do admin (dinâmico, sem ID fixo)
UPDATE public.profiles
SET company_id = (
    SELECT company_id FROM public.profiles
    WHERE email = 'vmtransportesrodoviarios@gmail.com' LIMIT 1
)
WHERE email = 'posto.teste@gmail.com';

-- 2. RLS: permitir ver todos os perfis da própria empresa
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS view_company_profiles ON public.profiles;
CREATE POLICY view_company_profiles ON public.profiles
    FOR SELECT TO authenticated
    USING (
        company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
        OR id = auth.uid()
    );

-- 3. DIAGNÓSTICO: quem está na empresa do admin agora
SELECT email, role, company_id
FROM public.profiles
WHERE company_id = (
    SELECT company_id FROM public.profiles
    WHERE email = 'vmtransportesrodoviarios@gmail.com' LIMIT 1
)
ORDER BY role;
