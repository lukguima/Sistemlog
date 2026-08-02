-- ============================================================
-- LOCKDOWN: painel Master e role master
-- ------------------------------------------------------------
-- 1) is_master() só confia no JWT app_metadata (não no profiles.role)
--    → impede auto-promoção alterando a linha em profiles
-- 2) Ninguém vira master via INSERT/UPDATE em profiles, exceto
--    quem JÁ é master no JWT
-- 3) master_settings / subscriptions sensíveis só para master
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'master',
        false
    );
$$;

-- Impede promover a master (ou criar profile master) sem já ser master no JWT
DROP POLICY IF EXISTS no_promote_to_master ON public.profiles;
CREATE POLICY no_promote_to_master ON public.profiles
    AS RESTRICTIVE
    FOR ALL
    TO authenticated
    USING (
        -- Leitura/delete de linha master: só master (ou a própria linha)
        role IS DISTINCT FROM 'master'
        OR public.is_master()
        OR id = auth.uid()
    )
    WITH CHECK (
        role IS DISTINCT FROM 'master'
        OR public.is_master()
    );

-- Reforço: settings globais só master
ALTER TABLE public.master_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ms_select" ON public.master_settings;
CREATE POLICY "ms_select" ON public.master_settings
    FOR SELECT TO authenticated
    USING (public.is_master());
DROP POLICY IF EXISTS "ms_upsert" ON public.master_settings;
CREATE POLICY "ms_upsert" ON public.master_settings
    FOR ALL TO authenticated
    USING (public.is_master())
    WITH CHECK (public.is_master());

-- Assinaturas: escrita só master (leitura da própria empresa permanece nas policies existentes)
DROP POLICY IF EXISTS "sub_insert" ON public.subscriptions;
DROP POLICY IF EXISTS "sub_update" ON public.subscriptions;
DROP POLICY IF EXISTS "sub_delete" ON public.subscriptions;
CREATE POLICY "sub_insert" ON public.subscriptions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_master());
CREATE POLICY "sub_update" ON public.subscriptions
    FOR UPDATE TO authenticated
    USING (public.is_master())
    WITH CHECK (public.is_master());
CREATE POLICY "sub_delete" ON public.subscriptions
    FOR DELETE TO authenticated
    USING (public.is_master());

-- ============================================================
-- CHECKLIST (rode logado como master no SQL Editor, ou via app):
-- 1) No Auth → Users → seu usuário → App Metadata deve ter:
--    { "role": "master" }
-- 2) Após o lockdown, profiles.role = 'master' SOZINHO NÃO basta.
-- 3) Para promover outro master: Dashboard Auth → editar usuário →
--    App Metadata role=master + profiles.role=master (service role).
-- NÃO use insert pelo browser sem JWT master.
-- ============================================================

SELECT
    public.is_master() AS sou_master_neste_jwt,
    auth.jwt() -> 'app_metadata' ->> 'role' AS role_no_jwt;
