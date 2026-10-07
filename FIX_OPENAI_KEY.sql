-- ============================================================
-- Chave OpenAI da empresa (leitura de CT-e e Gestor IA).
-- O navegador não lê a chave: só as Edge Functions, com service role.
-- Idempotente. Rodar no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_openai_keys (
    company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    api_key text NOT NULL,
    key_hint text,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_openai_keys ENABLE ROW LEVEL SECURITY;

-- Sem policy e sem GRANT para anon/authenticated: o navegador não lê a chave.
-- Só a service role (Edge Functions) acessa a tabela, e essas funções
-- já exigem admin/master da própria empresa antes de gravar ou apagar.
DROP POLICY IF EXISTS company_openai_keys_admin ON public.company_openai_keys;

REVOKE ALL ON public.company_openai_keys FROM PUBLIC;
REVOKE ALL ON public.company_openai_keys FROM anon;
REVOKE ALL ON public.company_openai_keys FROM authenticated;
GRANT ALL ON public.company_openai_keys TO service_role;

NOTIFY pgrst, 'reload schema';
