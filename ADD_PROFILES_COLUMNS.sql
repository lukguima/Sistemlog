-- ============================================================
-- SCRIPT DE AJUSTE TABELA PROFILES - SUPORTE A CONVITES (ROBUSTO)
-- ============================================================

-- 0. Habilita extensões necessárias para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Garante que as colunas básicas existem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'active') THEN
        ALTER TABLE public.profiles ADD COLUMN active boolean DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'admin';
    END IF;
END $$;

-- 2. Torna o ID autogerado para permitir convites sem usuário Auth prévio
-- Tentamos usar uuid_generate_v4() ou gen_random_uuid() como fallback
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 3. Remove a restrição de chave estrangeira rígida com auth.users no ID
-- Isso é CRUCIAL para permitir que o perfil exista antes do usuário ser criado no Auth do Supabase.
DO $$
DECLARE
    const_name text;
BEGIN
    -- Busca o nome da constraint de Foreign Key que aponta para auth.users
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass 
    AND contype = 'f' 
    AND confrelid = 'auth.users'::regclass;
    
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- 4. Adiciona restrição de unicidade no email para o trigger funcionar corretamente
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- 5. Atualiza a constraint de cargos permitidos
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'manager', 'operator', 'driver', 'master'));

-- 6. Recria o Trigger para "vincular" perfis existentes ao se cadastrar
-- Este trigger é disparado quando um novo registro entra em auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Se já existir um perfil com este e-mail (criado via convite manual), 
  -- atualizamos o ID dele para o ID real do Auth do Supabase.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = new.email) THEN
    UPDATE public.profiles 
    SET id = new.id,
        full_name = COALESCE(profiles.full_name, new.raw_user_meta_data->>'full_name'),
        avatar_url = COALESCE(profiles.avatar_url, new.raw_user_meta_data->>'avatar_url'),
        role = COALESCE(profiles.role, new.raw_user_meta_data->>'role', 'admin')
    WHERE email = new.email;
  ELSE
    -- Se não existir um perfil prévio, criamos um novo do zero
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        new.raw_user_meta_data->>'avatar_url',
        COALESCE(new.raw_user_meta_data->>'role', 'admin')
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
