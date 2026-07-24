-- ============================================================
-- FIX: cadastro não confia em user_metadata para role/empresa
-- ------------------------------------------------------------
-- Problema: o navegador pode mandar role=master ou company_id
-- de outra empresa em user_metadata no signUp.
--
-- Regras novas:
-- 1) Cadastro público → SEMPRE empresa NOVA + role admin
--    (ignora company_id/role do user_metadata)
-- 2) Usuário criado pela equipe (Edge Function service role)
--    → usa APENAS app_metadata (não manipulável pelo cliente)
-- 3) role "master" NUNCA vem do cadastro automático
--
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_company_id   uuid;
  v_company_name text;
  v_role         text;
  v_permissions  jsonb;
  v_from_admin   boolean;
  v_allowed      text[] := ARRAY['admin','manager','operator','driver','frentista'];
BEGIN
  -- app_metadata só o service role / dashboard consegue gravar
  v_from_admin := (
    NULLIF(NEW.raw_app_meta_data->>'company_id', '') IS NOT NULL
    AND NULLIF(NEW.raw_app_meta_data->>'role', '') IS NOT NULL
  );

  IF v_from_admin THEN
    v_company_id := (NEW.raw_app_meta_data->>'company_id')::uuid;
    v_role := lower(trim(NEW.raw_app_meta_data->>'role'));
    IF NOT (v_role = ANY (v_allowed)) THEN
      v_role := 'operator';
    END IF;
    v_permissions := COALESCE(NEW.raw_app_meta_data->'permissions', '[]'::jsonb);
    IF jsonb_typeof(v_permissions) <> 'array' THEN
      v_permissions := '[]'::jsonb;
    END IF;
  ELSE
    -- Cadastro público: ignora company_id/role do cliente
    v_company_id := gen_random_uuid();
    v_role := 'admin';
    v_permissions := '[]'::jsonb;
  END IF;

  v_company_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    'Empresa de ' || COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'nome', ''),
      split_part(NEW.email, '@', 1)
    )
  );

  -- Convite órfão: reaproveita permissions se ainda não vieram no app_metadata
  IF v_permissions = '[]'::jsonb THEN
    BEGIN
      SELECT permissions INTO v_permissions
      FROM public.profiles
      WHERE email = NEW.email
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_permissions := '[]'::jsonb;
    END;
    v_permissions := COALESCE(v_permissions, '[]'::jsonb);
  END IF;

  INSERT INTO public.companies (id, name, created_at)
  VALUES (v_company_id, v_company_name, now())
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.profiles WHERE email = NEW.email AND id <> NEW.id;

  INSERT INTO public.profiles (id, company_id, role, email, permissions)
  VALUES (NEW.id, v_company_id, v_role, NEW.email, v_permissions)
  ON CONFLICT (id) DO UPDATE SET
    company_id  = EXCLUDED.company_id,
    role        = EXCLUDED.role,
    email       = EXCLUDED.email,
    permissions = EXCLUDED.permissions;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
          'company_id',  v_company_id::text,
          'role',        v_role,
          'permissions', v_permissions
      )
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'FIX_SIGNUP_METADATA aplicado' AS resultado;
