-- ============================================================
-- PLANO 2 — MÓDULO EXTERNO DE ABASTECIMENTO (POSTO/TANQUE)
-- ------------------------------------------------------------
-- Adiciona a role 'frentista' — funcionário do tanque que só
-- acessa /posto e lança abastecimentos.
-- Idempotente. Não altera dados existentes.
-- ============================================================

-- Atualiza a constraint de roles permitidas para incluir 'frentista'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'manager', 'operator', 'driver', 'master', 'frentista'));

-- ============================================================
-- Como funciona o acesso do frentista:
--   1. O dono convida o funcionário em Configurações > Equipe
--      escolhendo "Frentista (posto)".
--   2. O funcionário acessa sistemlog.com.br/login uma vez no
--      celular; o sistema detecta a role e leva para /posto.
--   3. A sessão fica salva no aparelho (pode adicionar à tela
--      inicial e usar como app).
--   4. Cada abastecimento cai em fuel_records com company_id,
--      alimentando dashboard, km/l, custos e rentabilidade.
-- ============================================================
