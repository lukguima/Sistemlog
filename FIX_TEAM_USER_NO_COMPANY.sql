-- ============================================================
-- Frentista / equipe NÃO cria empresa no painel Master.
-- ------------------------------------------------------------
-- Problema: handle_new_user sempre fazia INSERT em companies.
-- Quando o caminho de equipe falhava ou era tratado como
-- cadastro público, nascia "Empresa de <nome>" + trial órfão.
--
-- Regras:
-- 1) Equipe (app_metadata.company_id + role) → só profile na
--    empresa existente. NÃO cria companies (nem trial).
-- 2) Cadastro público → empresa nova + admin + trial (igual).
-- 3) Limpa órfãs "Empresa de %" sem profile admin.
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email text;

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
  v_phone        text;
  v_full_name    text;
  v_company_ok   boolean;
BEGIN
  v_from_admin := (
    NULLIF(NEW.raw_app_meta_data->>'company_id', '') IS NOT NULL
    AND NULLIF(NEW.raw_app_meta_data->>'role', '') IS NOT NULL
  );

  v_phone := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  v_full_name := NULLIF(trim(COALESCE(
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'full_name',
    ''
  )), '');

  IF v_from_admin THEN
    -- Equipe / frentista: usa a empresa do admin. Nunca cria company.
    v_company_id := (NEW.raw_app_meta_data->>'company_id')::uuid;
    v_role := lower(trim(NEW.raw_app_meta_data->>'role'));
    IF NOT (v_role = ANY (v_allowed)) THEN
      v_role := 'operator';
    END IF;
    IF v_role = 'master' THEN
      v_role := 'operator';
    END IF;
    v_permissions := COALESCE(NEW.raw_app_meta_data->'permissions', '[]'::jsonb);
    IF jsonb_typeof(v_permissions) <> 'array' THEN
      v_permissions := '[]'::jsonb;
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = v_company_id)
      INTO v_company_ok;
    IF NOT v_company_ok THEN
      RAISE EXCEPTION 'Empresa % não existe para vínculo de equipe', v_company_id;
    END IF;

    DELETE FROM public.profiles WHERE email = NEW.email AND id <> NEW.id;

    INSERT INTO public.profiles (id, company_id, role, email, permissions, full_name, phone, active)
    VALUES (NEW.id, v_company_id, v_role, NEW.email, v_permissions, v_full_name, v_phone, true)
    ON CONFLICT (id) DO UPDATE SET
      company_id  = EXCLUDED.company_id,
      role        = EXCLUDED.role,
      email       = EXCLUDED.email,
      permissions = EXCLUDED.permissions,
      full_name   = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      phone       = COALESCE(EXCLUDED.phone, public.profiles.phone),
      active      = true;

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object(
            'company_id',  v_company_id::text,
            'role',        v_role,
            'permissions', v_permissions
        )
    WHERE id = NEW.id;

    RETURN NEW;
  END IF;

  -- Cadastro público: empresa NOVA + admin
  v_company_id := gen_random_uuid();
  v_role := 'admin';
  v_permissions := '[]'::jsonb;

  v_company_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    'Empresa de ' || COALESCE(v_full_name, split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.companies (id, name, phone, email, created_at)
  VALUES (v_company_id, v_company_name, v_phone, NEW.email, now())
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(public.companies.phone, EXCLUDED.phone),
    email = COALESCE(public.companies.email, EXCLUDED.email);

  DELETE FROM public.profiles WHERE email = NEW.email AND id <> NEW.id;

  INSERT INTO public.profiles (id, company_id, role, email, permissions, full_name, phone, active)
  VALUES (NEW.id, v_company_id, v_role, NEW.email, v_permissions, v_full_name, v_phone, true)
  ON CONFLICT (id) DO UPDATE SET
    company_id  = EXCLUDED.company_id,
    role        = EXCLUDED.role,
    email       = EXCLUDED.email,
    permissions = EXCLUDED.permissions,
    full_name   = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone       = COALESCE(EXCLUDED.phone, public.profiles.phone),
    active      = true;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
          'company_id',  v_company_id::text,
          'role',        v_role,
          'permissions', v_permissions
      )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- Limpeza: empresas fantasma sem admin (ex.: Empresa de Lucas)
-- Não apaga a transportadora real nem o login do frentista.
-- ------------------------------------------------------------
WITH orphans AS (
  SELECT c.id
  FROM public.companies c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.company_id = c.id AND p.role = 'admin'
  )
  AND (
    c.name ILIKE 'Empresa de %'
    OR EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.email = c.email
        AND p2.company_id IS DISTINCT FROM c.id
        AND p2.role IN ('frentista', 'operator', 'manager', 'driver')
    )
  )
)
DELETE FROM public.subscriptions s
WHERE s.company_id IN (SELECT id FROM orphans);

WITH orphans AS (
  SELECT c.id
  FROM public.companies c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.company_id = c.id AND p.role = 'admin'
  )
  AND (
    c.name ILIKE 'Empresa de %'
    OR EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.email = c.email
        AND p2.company_id IS DISTINCT FROM c.id
        AND p2.role IN ('frentista', 'operator', 'manager', 'driver')
    )
  )
)
DELETE FROM public.companies c
WHERE c.id IN (SELECT id FROM orphans);

SELECT 'FIX_TEAM_USER_NO_COMPANY aplicado' AS resultado;
