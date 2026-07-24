-- ============================================================
-- PLANO 3 — E4: RLS HARDENING POR SETOR (camada de segurança real)
-- ------------------------------------------------------------
-- Impede que um funcionário sem o setor consulte tabelas
-- daquele setor DIRETO pela API do Supabase (não só no menu).
--
-- >>> APLIQUE SOMENTE APÓS rodar PLANO3_SUBUSUARIOS.sql <<<
-- >>> e depois de testar o login de um funcionário.       <<<
--
-- DESIGN FAIL-CLOSED:
--   • role admin/master  → sempre liberado
--   • frentista → setor frota
--   • permissions NULL/[] → SEM acesso a setores
--   • funcionário com permissions SEM o setor → bloqueado
-- Preferir FIX_SECTOR_FAIL_CLOSED.sql / PERMISSOES_POR_ABA.sql
-- (versão com abas individuais).
-- Idempotente.
-- ============================================================

-- 1. Helper: o usuário atual tem acesso a um setor?
CREATE OR REPLACE FUNCTION public.jwt_has_sector(sector text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT
        COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
        OR (auth.jwt() -> 'app_metadata' -> 'permissions') ? sector
        -- Frentista lança abastecimento (setor frota), mas segue bloqueado
        -- do financeiro/operacional/análises.
        OR (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'frentista' AND sector = 'frota');
$$;

-- 2. Macro auxiliar: aplica a política restritiva de setor a uma tabela.
--    (executa via DO para cada tabela do setor)

-- ── SETOR FINANCEIRO ─────────────────────────────────────────
DO $$
DECLARE
    t text;
    financeiro_tables text[] := ARRAY[
        'financial_transactions',
        'accounts_payable',
        'accounts_receivable',
        'financings',
        'financing_installments',
        'accounting_documents',
        'tax_obligations',
        'investment_simulations',
        'financial_categories'
    ];
BEGIN
    FOREACH t IN ARRAY financeiro_tables LOOP
        -- só aplica se a tabela existir
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
            EXECUTE format('DROP POLICY IF EXISTS sector_guard_financeiro ON public.%I;', t);
            EXECUTE format($f$
                CREATE POLICY sector_guard_financeiro ON public.%I
                AS RESTRICTIVE FOR ALL TO authenticated
                USING (public.jwt_has_sector('financeiro'))
                WITH CHECK (public.jwt_has_sector('financeiro'));
            $f$, t);
        END IF;
    END LOOP;
END $$;

-- ── SETOR OPERACIONAL (viagens, acertos, agregados) ──────────
DO $$
DECLARE
    t text;
    operacional_tables text[] := ARRAY[
        'trips',
        'settlements',
        'driver_advances'
    ];
BEGIN
    FOREACH t IN ARRAY operacional_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
            EXECUTE format('DROP POLICY IF EXISTS sector_guard_operacional ON public.%I;', t);
            EXECUTE format($f$
                CREATE POLICY sector_guard_operacional ON public.%I
                AS RESTRICTIVE FOR ALL TO authenticated
                USING (public.jwt_has_sector('operacional'))
                WITH CHECK (public.jwt_has_sector('operacional'));
            $f$, t);
        END IF;
    END LOOP;
END $$;

-- ── SETOR FROTA (veículos, manutenção, abastecimento, pneus) ──
DO $$
DECLARE
    t text;
    frota_tables text[] := ARRAY[
        'maintenance',
        'fuel_records',
        'suppliers'
    ];
BEGIN
    FOREACH t IN ARRAY frota_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
            EXECUTE format('DROP POLICY IF EXISTS sector_guard_frota ON public.%I;', t);
            EXECUTE format($f$
                CREATE POLICY sector_guard_frota ON public.%I
                AS RESTRICTIVE FOR ALL TO authenticated
                USING (public.jwt_has_sector('frota'))
                WITH CHECK (public.jwt_has_sector('frota'));
            $f$, t);
        END IF;
    END LOOP;
END $$;

-- NOTA sobre 'vehicles' e 'drivers':
--   NÃO restringimos essas tabelas porque são lidas por vários
--   setores (operacional precisa do veículo/motorista da viagem;
--   frota gerencia). Bloquear quebraria selects legítimos.
--   A proteção de "quem cadastra" fica na camada de UI (botões).

-- 3. Anti-escalonamento: impede funcionário de alterar o próprio
--    role/permissions na tabela profiles (só admin/master pode).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_self_privilege_escalation ON public.profiles;
CREATE POLICY no_self_privilege_escalation ON public.profiles
    AS RESTRICTIVE FOR UPDATE TO authenticated
    USING (
        COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
        OR id = auth.uid()  -- pode editar o próprio perfil (nome), mas...
    )
    WITH CHECK (
        COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
        OR (
            -- ...funcionário não pode mudar role nem permissions de si mesmo
            id = auth.uid()
            AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
            AND permissions IS NOT DISTINCT FROM (SELECT permissions FROM public.profiles WHERE id = auth.uid())
        )
    );

-- ============================================================
-- ROLLBACK (se precisar desfazer):
--   DROP POLICY IF EXISTS sector_guard_financeiro ON public.financial_transactions;
--   ... (repetir para cada tabela)
--   DROP POLICY IF EXISTS no_self_privilege_escalation ON public.profiles;
--   DROP FUNCTION IF EXISTS public.jwt_has_sector(text);
-- ============================================================
