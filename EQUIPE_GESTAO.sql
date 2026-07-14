-- ============================================================
-- GESTÃO DA EQUIPE — admin vê/edita/exclui usuários da empresa
-- ------------------------------------------------------------
-- 1) Todos da empresa VEEM os perfis da própria empresa
--    (faz a aba Equipe listar todo mundo).
-- 2) Admin/master EDITAM qualquer perfil da própria empresa;
--    cada usuário pode editar o próprio (nome etc.).
-- 3) Trava anti-autopromoção: não-admin não muda a própria
--    role nem os próprios setores.
-- 4) Admin/master EXCLUEM perfis da empresa (nunca o próprio).
-- Idempotente.
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Ver a equipe da própria empresa
DROP POLICY IF EXISTS view_company_profiles ON public.profiles;
CREATE POLICY view_company_profiles ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    );

-- 2. Editar: admin/master na própria empresa; qualquer um a si mesmo
DROP POLICY IF EXISTS admin_update_company_profiles ON public.profiles;
CREATE POLICY admin_update_company_profiles ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        id = auth.uid()
        OR (
            COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
            AND company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
        )
    )
    WITH CHECK (
        id = auth.uid()
        OR (
            COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
            AND company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
        )
    );

-- 3. Trava anti-autopromoção (restritiva; compara com os claims do JWT
--    para não consultar a própria tabela — evita recursão de RLS)
DROP POLICY IF EXISTS no_self_privilege_escalation ON public.profiles;
CREATE POLICY no_self_privilege_escalation ON public.profiles
    AS RESTRICTIVE FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (
        COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
        OR (
            id = auth.uid()
            AND role = COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', role)
            AND COALESCE(permissions, '[]'::jsonb) = COALESCE(auth.jwt() -> 'app_metadata' -> 'permissions', COALESCE(permissions, '[]'::jsonb))
        )
    );

-- 4. Excluir: só admin/master, só da própria empresa, nunca a si mesmo
DROP POLICY IF EXISTS admin_delete_company_profiles ON public.profiles;
CREATE POLICY admin_delete_company_profiles ON public.profiles
    FOR DELETE TO authenticated
    USING (
        COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
        AND company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id')
        AND id <> auth.uid()
    );

SELECT 'GESTAO DE EQUIPE APLICADA' AS resultado;
