-- ============================================================
-- SUBSCRIPTION_TRIAL_SETUP.sql
-- Execute no SQL Editor do Supabase
--
-- Corrige:
-- 1. Trial para 7 dias (era 14)
-- 2. Trigger de signup: cria company + profile + subscription
-- 3. Função de auto-expiração de trial
-- 4. RLS corretas para subscriptions
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Corrigir trial para 7 dias
-- ──────────────────────────────────────────────────────────────

-- Atualizar trials existentes que ainda não expiraram (não muda os já expirados)
UPDATE public.subscriptions
SET trial_ends_at = created_at + interval '7 days'
WHERE status = 'trial'
  AND trial_ends_at > now()
  AND trial_ends_at > created_at + interval '8 days'; -- só os que tinham mais de 7 dias


-- ──────────────────────────────────────────────────────────────
-- 2. Trigger de criação de trial (manter 7 dias)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.subscriptions (
        company_id, plan, status, trial_ends_at, vehicle_limit, mrr
    )
    VALUES (
        NEW.id, 'trial', 'trial',
        now() + interval '7 days',
        5,
        0
    )
    ON CONFLICT (company_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
    AFTER INSERT ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.create_trial_subscription();


-- ──────────────────────────────────────────────────────────────
-- 3. Trigger de signup: cria company + profile ao criar usuário
--    O profile insert dispara sync_user_claims (app_metadata)
--    O company insert dispara create_trial_subscription
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_company_id  uuid;
    v_company_name text;
    v_role        text;
BEGIN
    -- Determinar company_id: usa o do metadata se já veio definido (convite),
    -- caso contrário gera um novo (auto-registro).
    v_company_id := COALESCE(
        NULLIF((NEW.raw_user_meta_data->>'company_id'), ''),
        NULLIF((NEW.raw_app_meta_data->>'company_id'), ''),
        uuid_generate_v4()
    )::uuid;

    v_company_name := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
        'Empresa de ' || COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
    );

    v_role := COALESCE(
        NULLIF((NEW.raw_user_meta_data->>'role'), ''),
        NULLIF((NEW.raw_app_meta_data->>'role'), ''),
        'admin'
    );

    -- 3a. Criar empresa (se não existir)
    INSERT INTO public.companies (id, name, created_at)
    VALUES (v_company_id, v_company_name, now())
    ON CONFLICT (id) DO NOTHING;

    -- 3b. Criar profile
    INSERT INTO public.profiles (id, company_id, role, email)
    VALUES (
        NEW.id,
        v_company_id,
        v_role,
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        role       = EXCLUDED.role,
        email      = EXCLUDED.email;

    -- 3c. Sincronizar claims no JWT (app_metadata) para que o AuthContext leia sem precisar de query extra
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
            'company_id', v_company_id::text,
            'role',       v_role
        )
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

-- Associar trigger ao auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ──────────────────────────────────────────────────────────────
-- 4. Trigger para manter app_metadata sincronizado quando profile for atualizado
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_user_claims()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
            'company_id', NEW.company_id::text,
            'role',       NEW.role
        )
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
    AFTER INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_user_claims();


-- ──────────────────────────────────────────────────────────────
-- 5. Função de auto-expiração de trial
--    Muda status de 'trial' → 'blocked' quando trial_ends_at passou
--    Muda status de 'active' → 'overdue' quando current_period_end passou
--    Chame via Supabase Edge Function cron ou pg_cron
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Trial expirado → bloqueado
    UPDATE public.subscriptions
    SET status = 'blocked',
        blocked_at  = now(),
        block_reason = 'Período de teste de 7 dias encerrado.'
    WHERE status = 'trial'
      AND trial_ends_at < now();

    -- Assinatura ativa expirada → inadimplente
    UPDATE public.subscriptions
    SET status = 'overdue',
        overdue_since = now()
    WHERE status = 'active'
      AND current_period_end IS NOT NULL
      AND current_period_end < now();
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 6. Agendar expiração com pg_cron (execute este bloco separado se tiver pg_cron habilitado)
-- ──────────────────────────────────────────────────────────────
-- SELECT cron.schedule('expire-subscriptions', '0 3 * * *', $$SELECT public.expire_subscriptions()$$);


-- ──────────────────────────────────────────────────────────────
-- 7. RLS da tabela subscriptions (usando JWT puro — sem recursão)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_select"  ON public.subscriptions;
DROP POLICY IF EXISTS "sub_insert"  ON public.subscriptions;
DROP POLICY IF EXISTS "sub_update"  ON public.subscriptions;
DROP POLICY IF EXISTS "sub_delete"  ON public.subscriptions;

-- Empresa vê própria assinatura; master vê todas
CREATE POLICY "sub_select" ON public.subscriptions
    FOR SELECT USING (
        company_id = public.my_company_id()
        OR public.is_master()
    );

-- Somente master pode inserir/atualizar/deletar
CREATE POLICY "sub_insert" ON public.subscriptions
    FOR INSERT WITH CHECK (public.is_master());

CREATE POLICY "sub_update" ON public.subscriptions
    FOR UPDATE USING (public.is_master());

CREATE POLICY "sub_delete" ON public.subscriptions
    FOR DELETE USING (public.is_master());

-- ──────────────────────────────────────────────────────────────
-- 8. Garantir que subscriptions existentes tenham trial de 7 dias
--    para empresas criadas recentemente (< 7 dias atrás)
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.subscriptions (company_id, plan, status, trial_ends_at, vehicle_limit, mrr)
SELECT c.id, 'trial', 'trial', c.created_at + interval '7 days', 5, 0
FROM public.companies c
WHERE c.id NOT IN (
    SELECT company_id FROM public.subscriptions WHERE company_id IS NOT NULL
)
ON CONFLICT (company_id) DO NOTHING;

-- Recarregar PostgREST
NOTIFY pgrst, 'reload schema';

SELECT 'SUBSCRIPTION_TRIAL_SETUP concluído — trial = 7 dias, triggers criados.' AS resultado;
