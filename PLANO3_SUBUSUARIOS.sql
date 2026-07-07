-- ============================================================
-- PLANO 3 — SUBUSUÁRIOS COM ACESSO POR SETOR
-- ------------------------------------------------------------
-- Adiciona a coluna `permissions` (jsonb) em profiles e faz os
-- triggers existentes copiarem essas permissões para o
-- app_metadata do JWT (server-side, não manipulável pelo usuário).
--
-- Idempotente: pode rodar mais de uma vez sem efeitos colaterais.
-- Não altera nenhum dado existente — admins seguem com acesso total.
-- ============================================================

-- 1. Coluna de permissões (lista de setores permitidos)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'permissions'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN permissions jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Garante que a coluna full_name existe (usada na listagem da equipe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'full_name'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN full_name text;
    END IF;
END $$;

-- 3. Atualiza o trigger de novo usuário (auth.users) para propagar permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_company_id   uuid;
    v_company_name text;
    v_role         text;
    v_permissions  jsonb;
BEGIN
    v_company_id := COALESCE(
        NULLIF((NEW.raw_user_meta_data->>'company_id'), ''),
        NULLIF((NEW.raw_app_meta_data->>'company_id'), ''),
        uuid_generate_v4()
    )::uuid;

    v_company_name := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
        'Empresa de ' || COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
    );

    v_role := COALESCE(
        NULLIF((NEW.raw_user_meta_data->>'role'), ''),
        NULLIF((NEW.raw_app_meta_data->>'role'), ''),
        'admin'
    );

    -- Se já existe um profile criado por convite, reutiliza suas permissions
    SELECT permissions INTO v_permissions FROM public.profiles WHERE email = NEW.email LIMIT 1;
    v_permissions := COALESCE(v_permissions, '[]'::jsonb);

    -- 3a. Criar empresa (se não existir)
    INSERT INTO public.companies (id, name, created_at)
    VALUES (v_company_id, v_company_name, now())
    ON CONFLICT (id) DO NOTHING;

    -- 3b. Criar / atualizar profile
    INSERT INTO public.profiles (id, company_id, role, email, permissions)
    VALUES (NEW.id, v_company_id, v_role, NEW.email, v_permissions)
    ON CONFLICT (id) DO UPDATE SET
        company_id  = EXCLUDED.company_id,
        role        = EXCLUDED.role,
        email       = EXCLUDED.email,
        permissions = EXCLUDED.permissions;

    -- 3c. Sincronizar claims no JWT (app_metadata)
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

-- 4. Atualiza o trigger de sincronização (profiles UPDATE/INSERT) para propagar permissions
CREATE OR REPLACE FUNCTION public.sync_user_claims()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
    AFTER INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_user_claims();

-- 5. Re-sincroniza os usuários já existentes (garante que admins tenham permissions no JWT)
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('permissions', COALESCE(p.permissions, '[]'::jsonb))
FROM public.profiles p
WHERE p.id = u.id;

-- ============================================================
-- Setores válidos (referência — não é enum, só documentação):
--   operacional   → Viagens, Acerto, Agregados
--   frota         → Frota, Manutenção, Abastecimento, Pneus, Fornecedores
--   financeiro    → Financeiro, Fluxo de Caixa, DRE, Financiamentos,
--                   Contabilidade, Rentabilidade, Simulador
--   analises      → Painel Executivo, Clientes, Gestor IA, Memória IA, Riscos
--   admin_config  → Configurações
-- Role 'admin' e 'master' ignoram permissions (acesso total).
-- ============================================================
