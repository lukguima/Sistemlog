-- ============================================================
-- FIX: bloqueio de escrita com assinatura vencida (server-side)
-- ------------------------------------------------------------
-- Hoje o app só desabilita botões na tela. Quem chama a API
-- direto ainda consegue inserir/editar/apagar.
--
-- Este script:
-- 1) Cria company_can_write() — espelha a regra do front
-- 2) Adiciona políticas RESTRICTIVE de INSERT/UPDATE/DELETE
--    nas tabelas operacionais (SELECT continua liberado)
--
-- Master nunca é bloqueado.
-- Sem linha em subscriptions → libera (igual ao front).
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

-- Helpers (se ainda não existirem)
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role = 'master' FROM public.profiles WHERE id = auth.uid() LIMIT 1),
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'master',
        false
    );
$$;

-- true = pode criar/editar/apagar dados da empresa
CREATE OR REPLACE FUNCTION public.company_can_write(p_company_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cid uuid;
    st text;
    trial_end timestamptz;
    period_end timestamptz;
BEGIN
    IF public.is_master() THEN
        RETURN true;
    END IF;

    cid := COALESCE(
        p_company_id,
        public.get_my_company_id(),
        NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::uuid
    );

    IF cid IS NULL THEN
        RETURN false;
    END IF;

    SELECT s.status, s.trial_ends_at, s.current_period_end
      INTO st, trial_end, period_end
    FROM public.subscriptions s
    WHERE s.company_id = cid
    LIMIT 1;

    -- Sem assinatura cadastrada → não bloqueia (mesma regra do front)
    IF NOT FOUND THEN
        RETURN true;
    END IF;

    IF st IN ('overdue', 'canceled', 'blocked') THEN
        RETURN false;
    END IF;

    -- Trial vencido (mesmo sem cron ter rodado)
    IF st = 'trial' AND trial_end IS NOT NULL AND trial_end < now() THEN
        RETURN false;
    END IF;

    -- Active vencido → trata como bloqueio de escrita
    IF st = 'active' AND period_end IS NOT NULL AND period_end < now() THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.company_can_write(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_can_write(uuid) TO authenticated;

-- Políticas RESTRICTIVE: precisam passar além das políticas normais (AND)
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'vehicles', 'drivers', 'trips', 'maintenance', 'fuel_records',
        'driver_advances', 'settings', 'tyres', 'tyre_checks',
        'settlements', 'suppliers', 'fixed_routes', 'clients',
        'financial_categories', 'cost_centers',
        'financial_transactions', 'accounts_payable', 'accounts_receivable',
        'financings', 'financing_installments',
        'ai_conversations', 'ai_insights', 'ai_business_memory',
        'compliance_documents'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables
            WHERE schemaname = 'public' AND tablename = t
        ) THEN
            CONTINUE;
        END IF;

        -- Só aplica se a tabela tiver company_id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = t AND column_name = 'company_id'
        ) THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        EXECUTE format('DROP POLICY IF EXISTS sub_gate_insert ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS sub_gate_update ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS sub_gate_delete ON public.%I', t);

        EXECUTE format(
            'CREATE POLICY sub_gate_insert ON public.%1$I'
            ' AS RESTRICTIVE FOR INSERT TO authenticated'
            ' WITH CHECK (public.company_can_write(company_id))',
            t
        );

        EXECUTE format(
            'CREATE POLICY sub_gate_update ON public.%1$I'
            ' AS RESTRICTIVE FOR UPDATE TO authenticated'
            ' USING (public.company_can_write(company_id))'
            ' WITH CHECK (public.company_can_write(company_id))',
            t
        );

        EXECUTE format(
            'CREATE POLICY sub_gate_delete ON public.%1$I'
            ' AS RESTRICTIVE FOR DELETE TO authenticated'
            ' USING (public.company_can_write(company_id))',
            t
        );
    END LOOP;
END $$;

-- Diagnóstico: empresas sem escrita liberada
SELECT
    c.name AS empresa,
    s.status,
    s.trial_ends_at,
    s.current_period_end,
    public.company_can_write(c.id) AS pode_escrever_como_master_check
FROM public.companies c
LEFT JOIN public.subscriptions s ON s.company_id = c.id
ORDER BY c.name
LIMIT 50;
