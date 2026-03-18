-- ============================================================
-- SUBSCRIPTION_SCHEMA.sql
-- Tabela de assinaturas integrada com Kiwify
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Dropar e recriar a tabela subscriptions com todos os campos necessários
DROP TABLE IF EXISTS public.subscriptions CASCADE;

CREATE TABLE public.subscriptions (
    id                      uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id              uuid REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,

    -- Plano e status
    plan                    text NOT NULL DEFAULT 'trial',   -- trial | basico | pro | enterprise
    status                  text NOT NULL DEFAULT 'trial',   -- trial | active | overdue | canceled | blocked

    -- Datas de controle
    trial_ends_at           timestamp with time zone DEFAULT (now() + interval '14 days'),
    current_period_start    timestamp with time zone,
    current_period_end      timestamp with time zone,
    overdue_since           timestamp with time zone,
    blocked_at              timestamp with time zone,
    canceled_at             timestamp with time zone,

    -- Limite de veículos do plano (NULL = ilimitado)
    vehicle_limit           integer DEFAULT 5,

    -- Valor
    mrr                     numeric DEFAULT 0,               -- receita recorrente mensal

    -- IDs Kiwify para correlação
    kiwify_order_id         text,
    kiwify_subscription_id  text,
    kiwify_customer_id      text,
    kiwify_customer_email   text,

    -- Link de pagamento (URL do plano no Kiwify)
    checkout_url            text,

    -- Motivo do bloqueio manual pelo master
    block_reason            text,

    -- Controle
    created_at              timestamp with time zone DEFAULT now(),
    updated_at              timestamp with time zone DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id  ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status      ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_kiwify_sub  ON public.subscriptions(kiwify_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_kiwify_email ON public.subscriptions(kiwify_customer_email);

-- RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Admins veem apenas a própria assinatura; master vê todas
DROP POLICY IF EXISTS "sub_select" ON public.subscriptions;
CREATE POLICY "sub_select" ON public.subscriptions
    FOR SELECT USING (
        company_id = public.get_my_company_id()
        OR public.is_master()
    );

DROP POLICY IF EXISTS "sub_insert" ON public.subscriptions;
CREATE POLICY "sub_insert" ON public.subscriptions
    FOR INSERT WITH CHECK (public.is_master());

DROP POLICY IF EXISTS "sub_update" ON public.subscriptions;
CREATE POLICY "sub_update" ON public.subscriptions
    FOR UPDATE USING (public.is_master());

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função auxiliar: retorna vehicle_limit a partir do plano
CREATE OR REPLACE FUNCTION public.plan_vehicle_limit(p_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE p_plan
        WHEN 'basico'     THEN 5
        WHEN 'pro'        THEN 10
        WHEN 'enterprise' THEN NULL   -- NULL = ilimitado
        ELSE 5                        -- trial usa limite básico
    END;
$$;

-- Criar trial automático quando uma nova empresa é cadastrada
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.subscriptions (company_id, plan, status, trial_ends_at, vehicle_limit)
    VALUES (NEW.id, 'trial', 'trial', now() + interval '14 days', 5)
    ON CONFLICT (company_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
    AFTER INSERT ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.create_trial_subscription();

-- Criar subscriptions em trial para empresas existentes que ainda não têm
INSERT INTO public.subscriptions (company_id, plan, status, trial_ends_at, vehicle_limit)
SELECT id, 'trial', 'trial', now() + interval '14 days', 5
FROM public.companies
WHERE id NOT IN (SELECT company_id FROM public.subscriptions WHERE company_id IS NOT NULL)
ON CONFLICT (company_id) DO NOTHING;

-- Atualizar vehicle_limit para registros existentes baseado no plano
UPDATE public.subscriptions
SET vehicle_limit = public.plan_vehicle_limit(plan)
WHERE vehicle_limit IS NULL;

-- Recarregar PostgREST
NOTIFY pgrst, 'reload schema';
