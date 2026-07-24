-- ============================================================
-- FIX: permissões de setor fail-closed (sem liberar tudo)
-- ------------------------------------------------------------
-- Antes: se app_metadata.permissions era NULL, jwt_has_sector
-- liberava TODOS os setores (fail-open).
--
-- Agora:
--   • admin / master → acesso total
--   • frentista → só frota
--   • demais → precisa ter o setor ou aba na lista
--   • permissions NULL ou [] → SEM acesso a setores
--
-- Se algum funcionário antigo ficar sem menus, o admin deve
-- editar a equipe e marcar as abas de novo.
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.jwt_has_sector(sector text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT
        COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
        OR (
            COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'frentista'
            AND sector = 'frota'
        )
        OR (
            jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'permissions') = 'array'
            AND (
                (auth.jwt() -> 'app_metadata' -> 'permissions') ? sector
                OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(
                        auth.jwt() -> 'app_metadata' -> 'permissions'
                    ) AS perm(k)
                    WHERE perm.k = ANY (
                        CASE sector
                            WHEN 'dashboard'   THEN ARRAY['dashboard']
                            WHEN 'operacional' THEN ARRAY['trips','settlement','agregados']
                            WHEN 'frota'       THEN ARRAY['fleet','documents','maintenance','fuel','tyre-check','suppliers']
                            WHEN 'financeiro'  THEN ARRAY['financial','cash-flow','dre','vehicle-profitability','financings','simulator','accounting']
                            WHEN 'analises'    THEN ARRAY['executive','clients-analysis','ai-manager','ai-memory','risks','reports']
                            ELSE ARRAY[]::text[]
                        END
                    )
                )
            )
        );
$$;

SELECT 'FIX_SECTOR_FAIL_CLOSED aplicado' AS resultado;
