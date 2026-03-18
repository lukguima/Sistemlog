-- ============================================================
-- FIX_ALL_ISSUES.sql
-- Correções consolidadas — execute no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. GARANTIR COLUNA 'odometer' EM fuel_records
--    (O código usa 'odometer'; scripts antigos adicionavam 'km_reading')
-- ============================================================
ALTER TABLE public.fuel_records ADD COLUMN IF NOT EXISTS odometer numeric;

-- Se a coluna km_reading existir, copiar dados para odometer e remover
DO $migrate$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'fuel_records'
          AND column_name = 'km_reading'
    ) THEN
        UPDATE public.fuel_records
        SET odometer = km_reading
        WHERE odometer IS NULL AND km_reading IS NOT NULL;

        ALTER TABLE public.fuel_records DROP COLUMN km_reading;
    END IF;
END $migrate$;

-- ============================================================
-- 2. DEDUPLICAR e depois criar CONSTRAINT ÚNICO
--    (vehicle_id, odometer) — evita abastecimentos duplicados
-- ============================================================

-- Remover constraint anterior se existir
ALTER TABLE public.fuel_records
    DROP CONSTRAINT IF EXISTS fuel_records_vehicle_odometer_unique;

-- Remover duplicatas mantendo apenas o registro mais recente (maior created_at)
-- para cada par (vehicle_id, odometer)
DELETE FROM public.fuel_records
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY vehicle_id, odometer
                   ORDER BY created_at DESC
               ) AS rn
        FROM public.fuel_records
        WHERE vehicle_id IS NOT NULL
          AND odometer IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Agora é seguro criar o constraint único
ALTER TABLE public.fuel_records
    ADD CONSTRAINT fuel_records_vehicle_odometer_unique
    UNIQUE (vehicle_id, odometer);

-- ============================================================
-- 3. COLUNAS FINANCEIRAS DE VIAGEM (pedágio e seguro por viagem)
-- ============================================================
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS tolls_value     DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS insurance_value DECIMAL(10,2) DEFAULT 0;

-- Seguro fixo de veículo
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS insurance_value DECIMAL(10,2) DEFAULT 0;

-- ============================================================
-- 4. COLUNA 'last_km' EM tyres (usada pelo TyreCheck)
-- ============================================================
ALTER TABLE public.tyres ADD COLUMN IF NOT EXISTS last_km numeric DEFAULT 0;

-- ============================================================
-- 5. COLUNAS DE DOCUMENTOS (vencimento CNH, CRLV, ANTT)
-- ============================================================
ALTER TABLE public.drivers  ADD COLUMN IF NOT EXISTS license_expiry   date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS document_expiry  date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS antt_expiry      date;

-- ============================================================
-- 6. TABELA DE ACERTOS (settlements) — criada se não existir
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settlements (
    id               uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id       uuid REFERENCES public.companies(id),
    driver_id        uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
    total_gross      numeric DEFAULT 0,
    total_trip_discounts  numeric DEFAULT 0,
    total_advances_applied numeric DEFAULT 0,
    net_paid         numeric DEFAULT 0,
    trips_ids        uuid[],
    advances_ids     uuid[],
    status           text DEFAULT 'paid',
    settlement_date  timestamp with time zone DEFAULT now(),
    created_at       timestamp with time zone DEFAULT now()
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. TABELAS DE FORNECEDORES E ROTAS FIXAS (se não existirem)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id  uuid REFERENCES public.companies(id),
    name        text NOT NULL,
    category    text,
    contact     text,
    phone       text,
    email       text,
    address     text,
    notes       text,
    created_at  timestamp with time zone DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.fixed_routes (
    id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id  uuid REFERENCES public.companies(id),
    origin      text NOT NULL,
    destination text NOT NULL,
    distance_km numeric,
    freight_value numeric,
    notes       text,
    created_at  timestamp with time zone DEFAULT now()
);

ALTER TABLE public.fixed_routes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. RLS REAL POR company_id
--    Substitui as políticas "Allow all" por isolamento real.
--    Usuários só veem dados da própria empresa.
-- ============================================================

-- Helper: busca o company_id do usuário autenticado via profiles
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Função para verificar se o usuário é master (sem company_id)
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT role = 'master' FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Macro para criar políticas isoladas por company_id em cada tabela
DO $outer$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'vehicles','drivers','trips','maintenance','fuel_records',
        'driver_advances','settings','tyres','tyre_checks',
        'settlements','suppliers','fixed_routes'
    ])
    LOOP
        -- Remover políticas antigas permissivas
        EXECUTE format('DROP POLICY IF EXISTS "Allow all"       ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "tenant_select"   ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "tenant_insert"   ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "tenant_update"   ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "tenant_delete"   ON public.%I', t);

        -- Política de leitura: própria empresa OU master
        EXECUTE format(
            'CREATE POLICY "tenant_select" ON public.%1$I'
            ' FOR SELECT USING ('
            '   company_id = public.get_my_company_id() OR public.is_master()'
            ')', t);

        -- Política de inserção
        EXECUTE format(
            'CREATE POLICY "tenant_insert" ON public.%1$I'
            ' FOR INSERT WITH CHECK ('
            '   company_id = public.get_my_company_id() OR public.is_master()'
            ')', t);

        -- Política de atualização
        EXECUTE format(
            'CREATE POLICY "tenant_update" ON public.%1$I'
            ' FOR UPDATE USING ('
            '   company_id = public.get_my_company_id() OR public.is_master()'
            ')', t);

        -- Política de exclusão
        EXECUTE format(
            'CREATE POLICY "tenant_delete" ON public.%1$I'
            ' FOR DELETE USING ('
            '   company_id = public.get_my_company_id() OR public.is_master()'
            ')', t);
    END LOOP;
END $outer$;

-- Profiles: cada usuário vê apenas o próprio perfil (ou master vê todos)
DROP POLICY IF EXISTS "Allow all"      ON public.profiles;
DROP POLICY IF EXISTS "profile_select" ON public.profiles;
DROP POLICY IF EXISTS "profile_update" ON public.profiles;
CREATE POLICY "profile_select" ON public.profiles
    FOR SELECT USING (id = auth.uid() OR public.is_master());
CREATE POLICY "profile_update" ON public.profiles
    FOR UPDATE USING (id = auth.uid() OR public.is_master());

-- Companies: master vê todas, admins veem apenas a própria
DROP POLICY IF EXISTS "Allow all"      ON public.companies;
DROP POLICY IF EXISTS "company_select" ON public.companies;
DROP POLICY IF EXISTS "company_update" ON public.companies;
CREATE POLICY "company_select" ON public.companies
    FOR SELECT USING (id = public.get_my_company_id() OR public.is_master());
CREATE POLICY "company_update" ON public.companies
    FOR UPDATE USING (id = public.get_my_company_id() OR public.is_master());

-- Leads: apenas master
DROP POLICY IF EXISTS "Allow all"         ON public.leads;
DROP POLICY IF EXISTS "leads_master_only" ON public.leads;
CREATE POLICY "leads_master_only" ON public.leads
    FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

-- ============================================================
-- 9. ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trips_company_id        ON public.trips(company_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id         ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id        ON public.trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_status            ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_created_at        ON public.trips(created_at);

CREATE INDEX IF NOT EXISTS idx_fuel_records_company_id ON public.fuel_records(company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_vehicle_id ON public.fuel_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_driver_id  ON public.fuel_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_created_at ON public.fuel_records(created_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_company_id  ON public.maintenance(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id  ON public.maintenance(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_driver_advances_company ON public.driver_advances(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_advances_driver  ON public.driver_advances(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_advances_status  ON public.driver_advances(status);

CREATE INDEX IF NOT EXISTS idx_tyres_company_id        ON public.tyres(company_id);
CREATE INDEX IF NOT EXISTS idx_tyres_vehicle_id        ON public.tyres(vehicle_id);

-- ============================================================
-- 10. PLANOS DE ASSINATURA — coluna vehicle_limit
--     Migração segura para tabela subscriptions já existente
-- ============================================================

-- Adicionar coluna se ainda não existir
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS vehicle_limit integer DEFAULT 5;

-- Atualizar limites baseado no plano atual de cada empresa
UPDATE public.subscriptions SET vehicle_limit = 5   WHERE plan IN ('trial', 'basico') AND vehicle_limit IS NULL;
UPDATE public.subscriptions SET vehicle_limit = 10  WHERE plan = 'pro'        AND vehicle_limit IS NULL;
UPDATE public.subscriptions SET vehicle_limit = NULL WHERE plan = 'enterprise' AND vehicle_limit IS NULL;

-- Garantir que empresas recém-migradas também tenham o valor correto
UPDATE public.subscriptions
SET vehicle_limit = CASE plan
    WHEN 'basico'     THEN 5
    WHEN 'pro'        THEN 10
    WHEN 'enterprise' THEN NULL
    ELSE 5
END
WHERE vehicle_limit IS NULL OR vehicle_limit = 0;

-- RLS para subscriptions (idempotente)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_select" ON public.subscriptions;
CREATE POLICY "sub_select" ON public.subscriptions
    FOR SELECT USING (company_id = public.get_my_company_id() OR public.is_master());

DROP POLICY IF EXISTS "sub_insert" ON public.subscriptions;
CREATE POLICY "sub_insert" ON public.subscriptions
    FOR INSERT WITH CHECK (public.is_master());

DROP POLICY IF EXISTS "sub_update" ON public.subscriptions;
CREATE POLICY "sub_update" ON public.subscriptions
    FOR UPDATE USING (public.is_master());

-- ============================================================
-- 11. TABELA master_settings — configurações globais do SaaS
--     Usada por GlobalSettings.tsx e Subscriptions.tsx (master)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.master_settings (
    key        text PRIMARY KEY,
    value      text NOT NULL DEFAULT '',
    updated_at timestamp with time zone DEFAULT now()
);

-- Seed inicial com as URLs Kiwify e dias de trial
INSERT INTO public.master_settings (key, value) VALUES
    ('checkout_url_basico',    'https://pay.kiwify.com.br/Xo5neXV'),
    ('checkout_url_pro',       'https://pay.kiwify.com.br/9f3rjhC'),
    ('checkout_url_enterprise','https://pay.kiwify.com.br/itrSZqN'),
    ('trial_days',             '14')
ON CONFLICT (key) DO NOTHING;

-- RLS: apenas master pode ler/escrever
ALTER TABLE public.master_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ms_select" ON public.master_settings;
CREATE POLICY "ms_select" ON public.master_settings
    FOR SELECT USING (public.is_master());

DROP POLICY IF EXISTS "ms_upsert" ON public.master_settings;
CREATE POLICY "ms_upsert" ON public.master_settings
    FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

-- ============================================================
-- 12. RECARREGAR CACHE DO POSTGREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
