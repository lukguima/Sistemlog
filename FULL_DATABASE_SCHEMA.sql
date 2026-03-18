-- ============================================================
-- SCRIPT MESTRE DE BANCO DE DADOS - LOGISSAAS V2 (CONSOLIDADO)
-- Este script prepara todo o ambiente Supabase para rodar o
-- sistema sem entraves de tabelas ou colunas faltantes.
-- ============================================================

-- 0. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABELA DE EMPRESAS (TENANTS)
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    document text, -- CNPJ
    status text DEFAULT 'active',
    created_at timestamp with time zone DEFAULT now()
);

-- 2. TABELA DE PERFIS (ADMINS / USUÁRIOS)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email text,
    full_name text,
    avatar_url text,
    role text DEFAULT 'admin', -- admin, driver, master
    company_id uuid REFERENCES public.companies(id),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. TABELA DE CONFIGURAÇÕES (BRANDING)
CREATE TABLE IF NOT EXISTS public.settings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) UNIQUE,
    system_name text,
    primary_color text DEFAULT '#2563EB',
    logo_url text,
    active_modules jsonb DEFAULT '["portal", "driver_app", "monitoring"]'::jsonb,
    tax_rate numeric DEFAULT 0,
    commission_rate numeric DEFAULT 12,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. TABELA DE VEÍCULOS
CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    plate text NOT NULL,
    model text,
    brand text,
    year integer,
    current_km numeric DEFAULT 0,
    status text DEFAULT 'active', -- active, maintenance, inactive
    truck_type text, -- Ex: truck, trailer, 3/4, Sider
    axle_count integer DEFAULT 2,
    -- Intervalos de Manutenção
    maint_oil_interval integer DEFAULT 15000,
    maint_filter_interval integer DEFAULT 30000,
    maint_tyre_interval integer DEFAULT 60000,
    last_oil_change_km integer DEFAULT 0,
    last_filter_change_km integer DEFAULT 0,
    last_tyre_change_km integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 5. TABELA DE MOTORISTAS
CREATE TABLE IF NOT EXISTS public.drivers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    name text NOT NULL,
    email text,
    phone text,
    license_number text,
    license_category text,
    status text DEFAULT 'active', -- active, inactive
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 6. TABELA DE VIAGENS E FRETES
CREATE TABLE IF NOT EXISTS public.trips (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
    driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
    origin text,
    destination text,
    weight numeric,
    cte_number text,
    gross_value numeric DEFAULT 0,
    tax_rate numeric DEFAULT 0,
    commission_rate numeric DEFAULT 0,
    estimated_cost numeric DEFAULT 0,
    advance_value numeric DEFAULT 0,
    status text DEFAULT 'pending', -- pending, in_transit, completed, validated, paid
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 7. TABELA DE MANUTENÇÕES
CREATE TABLE IF NOT EXISTS public.maintenance (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
    description text,
    cost numeric DEFAULT 0,
    date timestamp with time zone DEFAULT now(),
    km numeric,
    type text DEFAULT 'preventive', -- preventive, corrective
    workshop text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- 8. TABELA DE ABASTECIMENTOS
CREATE TABLE IF NOT EXISTS public.fuel_records (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
    odometer numeric,
    liters numeric,
    price_per_liter numeric,
    total_value numeric,
    location text,
    fuel_type text,
    created_at timestamp with time zone DEFAULT now()
);

-- 9. TABELA DE VALES E ADIANTAMENTOS
CREATE TABLE IF NOT EXISTS public.driver_advances (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    description text,
    date timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending', -- pending, settled, paid
    created_at timestamp with time zone DEFAULT now()
);

-- 10. TABELA DE PNEUS
CREATE TABLE IF NOT EXISTS public.tyres (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
    serial_number text,
    brand text,
    model text,
    size text,
    position text,
    tread_depth_mm numeric DEFAULT 0,
    install_date timestamp with time zone DEFAULT now(),
    status text DEFAULT 'good', -- good, warning, critical, stock, discarded
    created_at timestamp with time zone DEFAULT now()
);

-- 11. TABELA DE INSPEÇÕES DE PNEUS (HISTÓRICO)
CREATE TABLE IF NOT EXISTS public.tyre_checks (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    tyre_id uuid REFERENCES public.tyres(id) ON DELETE CASCADE,
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
    depth_mm numeric,
    pressure numeric,
    km numeric,
    type text DEFAULT 'check', -- check, install, rotate, repair
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- 12. TABELA DE LEADS (LANDING PAGE)
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text,
    email text,
    phone text,
    whatsapp text,
    company_name text,
    created_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- RLS - ROW LEVEL SECURITY (MULTI-TENANCY)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyre_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS "ALLOW ALL" (Simplificado para o usuário ter controle total inicial)
-- Nota: Em produção, estas políticas devem ser restritas ao company_id do usuário.

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('profiles', 'vehicles', 'drivers', 'trips', 'maintenance', 'fuel_records', 'driver_advances', 'settings', 'tyres', 'tyre_checks', 'leads', 'companies')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Allow all" ON public.%1$I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- ============================================================
-- TRIGGERS E FUNÇÕES AUTOMÁTICAS
-- ============================================================

-- Função para criar perfil automaticamente ao registrar novo usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
      new.id, 
      new.email, 
      new.raw_user_meta_data->>'full_name', 
      new.raw_user_meta_data->>'avatar_url',
      COALESCE(new.raw_user_meta_data->>'role', 'admin')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para atualizar current_km no veículo quando entrar uma manutenção ou abastecimento
CREATE OR REPLACE FUNCTION public.update_vehicle_km()
RETURNS trigger AS $$
BEGIN
    IF (TG_TABLE_NAME = 'maintenance') THEN
        UPDATE public.vehicles SET current_km = GREATEST(current_km, NEW.km) WHERE id = NEW.vehicle_id;
    ELSIF (TG_TABLE_NAME = 'fuel_records') THEN
        UPDATE public.vehicles SET current_km = GREATEST(current_km, NEW.odometer) WHERE id = NEW.vehicle_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_update_km_maint ON public.maintenance;
CREATE TRIGGER tr_update_km_maint AFTER INSERT OR UPDATE ON public.maintenance FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_km();

DROP TRIGGER IF EXISTS tr_update_km_fuel ON public.fuel_records;
CREATE TRIGGER tr_update_km_fuel AFTER INSERT OR UPDATE ON public.fuel_records FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_km();

-- ============================================================
-- DADOS INICIAIS (OPCIONAL)
-- ============================================================
-- Se necessário, você pode criar uma empresa padrão para testes iniciais
-- INSERT INTO public.companies (name, document) VALUES ('Minha Transportadora', '00.000.000/0001-00') ON CONFLICT DO NOTHING;
