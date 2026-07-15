-- ============================================================
-- PERMISSÕES POR ABA — atualização da trava de setor no banco
-- ------------------------------------------------------------
-- O convite agora grava abas individuais (ex.: 'trips', 'dre').
-- Esta versão do jwt_has_sector aceita:
--   • chaves de setor antigas ('financeiro')  → pacote inteiro
--   • chaves de aba novas ('trips', 'fleet')  → conta para o setor da aba
--   • frentista → setor frota (posto)
-- Idempotente. OBRIGATÓRIO rodar junto com o deploy desta versão.
-- ============================================================

CREATE OR REPLACE FUNCTION public.jwt_has_sector(sector text)
RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT
        COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'master')
        OR (auth.jwt() -> 'app_metadata' -> 'permissions') IS NULL
        OR (auth.jwt() -> 'app_metadata' -> 'permissions') ? sector
        OR (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'frentista' AND sector = 'frota')
        OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
                COALESCE(auth.jwt() -> 'app_metadata' -> 'permissions', '[]'::jsonb)
            ) AS perm(k)
            WHERE perm.k = ANY (
                CASE sector
                    WHEN 'operacional' THEN ARRAY['trips','settlement','agregados']
                    WHEN 'frota'       THEN ARRAY['fleet','documents','maintenance','fuel','tyre-check','suppliers']
                    WHEN 'financeiro'  THEN ARRAY['financial','cash-flow','dre','vehicle-profitability','financings','simulator','accounting']
                    WHEN 'analises'    THEN ARRAY['executive','clients-analysis','ai-manager','ai-memory','risks','reports']
                    ELSE ARRAY[]::text[]
                END
            )
        );
$$;

SELECT 'PERMISSOES POR ABA APLICADAS' AS resultado;
