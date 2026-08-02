-- ============================================================
-- Telefone de contato no painel Master (empresas / clientes SaaS)
-- ------------------------------------------------------------
-- 1) Garante colunas phone em companies e profiles
-- 2) Atualiza handle_new_user para gravar telefone do cadastro
-- 3) Backfill a partir do user_metadata (auth.users)
-- Rode no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

-- Persiste telefone (e nome) no signup público / criação de usuário
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
    v_company_id := gen_random_uuid();
    v_role := 'admin';
    v_permissions := '[]'::jsonb;
  END IF;

  v_company_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
    'Empresa de ' || COALESCE(v_full_name, split_part(NEW.email, '@', 1))
  );

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

  INSERT INTO public.companies (id, name, phone, email, created_at)
  VALUES (v_company_id, v_company_name, v_phone, NEW.email, now())
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(public.companies.phone, EXCLUDED.phone),
    email = COALESCE(public.companies.email, EXCLUDED.email);

  DELETE FROM public.profiles WHERE email = NEW.email AND id <> NEW.id;

  INSERT INTO public.profiles (id, company_id, role, email, permissions, full_name, phone)
  VALUES (NEW.id, v_company_id, v_role, NEW.email, v_permissions, v_full_name, v_phone)
  ON CONFLICT (id) DO UPDATE SET
    company_id  = EXCLUDED.company_id,
    role        = EXCLUDED.role,
    email       = EXCLUDED.email,
    permissions = EXCLUDED.permissions,
    full_name   = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone       = COALESCE(EXCLUDED.phone, public.profiles.phone);

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

-- Backfill: telefone do metadata → companies / profiles
UPDATE public.companies c
SET phone = COALESCE(NULLIF(trim(c.phone), ''), NULLIF(trim(u.raw_user_meta_data->>'phone'), ''))
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.company_id = c.id
  AND (c.phone IS NULL OR trim(c.phone) = '')
  AND NULLIF(trim(u.raw_user_meta_data->>'phone'), '') IS NOT NULL;

UPDATE public.profiles p
SET phone = COALESCE(NULLIF(trim(p.phone), ''), NULLIF(trim(u.raw_user_meta_data->>'phone'), ''))
FROM auth.users u
WHERE u.id = p.id
  AND (p.phone IS NULL OR trim(p.phone) = '')
  AND NULLIF(trim(u.raw_user_meta_data->>'phone'), '') IS NOT NULL;

-- Também copia phone da empresa para o admin, se faltar
UPDATE public.profiles p
SET phone = c.phone
FROM public.companies c
WHERE p.company_id = c.id
  AND p.role = 'admin'
  AND (p.phone IS NULL OR trim(p.phone) = '')
  AND c.phone IS NOT NULL
  AND trim(c.phone) <> '';

SELECT
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND trim(phone) <> '') AS empresas_com_telefone,
  COUNT(*) AS total_empresas
FROM public.companies;
