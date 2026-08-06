-- ============================================================
-- URLs de checkout públicas (landing / botões de pagamento)
-- ------------------------------------------------------------
-- master_settings continua editável só pelo master (RLS).
-- Esta RPC SECURITY DEFINER expõe APENAS as 3 URLs de checkout
-- para anon/authenticated — sem trial_days nem outras chaves.
--
-- Ops (Supabase Auth → URL Configuration):
--   Site URL: https://sistemlog.com.br
--   Redirect URLs: https://sistemlog.com.br/auth/callback
--                  https://sistemlog.com.br/**
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_checkout_urls()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_object_agg(key, to_jsonb(value))
      FROM public.master_settings
      WHERE key IN (
        'checkout_url_basico',
        'checkout_url_pro',
        'checkout_url_enterprise'
      )
    ),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_checkout_urls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_checkout_urls() TO anon, authenticated;

-- Sanity check (deve retornar as 3 chaves se já salvas no Master)
SELECT public.get_public_checkout_urls();
