-- ============================================================
-- CORREÇÃO DEFINITIVA — criação de usuários travada
-- ------------------------------------------------------------
-- Sintoma: "Database error creating new user" em QUALQUER via
-- (painel Supabase, convite do sistema, cadastro público).
-- Causa: o trigger handle_new_user falha internamente (coluna
-- ausente, conflito de e-mail órfão ou função uuid fora do
-- search_path) e derruba a transação inteira.
-- Este script blinda os triggers: qualquer falha interna vira
-- WARNING e a criação do usuário SEMPRE conclui.
-- Idempotente.
-- ============================================================

-- 1. Colunas necessárias em profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='permissions') THEN
    ALTER TABLE public.profiles ADD COLUMN permissions jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='full_name') THEN
    ALTER TABLE public.profiles ADD COLUMN full_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='active') THEN
    ALTER TABLE public.profiles ADD COLUMN active boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
    ALTER TABLE public.profiles ADD COLUMN email text;
  END IF;
END $$;

-- 2. Roles permitidas (inclui frentista)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin','manager','operator','driver','master','frentista'));

-- 3. Trigger de novo usuário — blindado + sem confiar em user_metadata
--    (mesma lógica de FIX_SIGNUP_METADATA.sql)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  v_company_id   uuid;
  v_company_name text;
  v_role         text;
  v_permissions  jsonb;
  v_from_admin   boolean;
  v_allowed      text[] := ARRAY['admin','manager','operator','driver','frentista'];
BEGIN
  -- app_metadata só service role / dashboard grava → caminho equipe
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
    -- Cadastro público: SEMPRE empresa nova + admin (ignora spoofing)
    v_company_id := gen_random_uuid();
    v_role := 'admin';
    v_permissions := '[]'::jsonb;
  END IF;

  v_company_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    'Empresa de ' || COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
  );

  IF v_permissions = '[]'::jsonb THEN
    BEGIN
      SELECT permissions INTO v_permissions FROM public.profiles WHERE email = NEW.email LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_permissions := '[]'::jsonb;
    END;
    v_permissions := COALESCE(v_permissions, '[]'::jsonb);
  END IF;

  INSERT INTO public.companies (id, name, created_at)
  VALUES (v_company_id, v_company_name, now())
  ON CONFLICT (id) DO NOTHING;

  -- Remove convite órfão com o mesmo e-mail (id diferente)
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

-- 4. Sincronização de claims — versão blindada
CREATE OR REPLACE FUNCTION public.sync_user_claims()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
          'company_id',  NEW.company_id::text,
          'role',        NEW.role,
          'permissions', COALESCE(NEW.permissions, '[]'::jsonb)
      )
  WHERE id = NEW.id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_user_claims falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_claims();

SELECT 'CORRECAO APLICADA COM SUCESSO' AS resultado;
