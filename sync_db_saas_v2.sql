-- ==========================================
-- SCRIPT DE SINCRONIZAÇÃO SAAS V2 (ENGLISH)
-- Focado em logistica-saas-v2
-- ==========================================

-- 0. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tabela profiles (Usuários/Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email text,
    full_name text,
    avatar_url text,
    role text DEFAULT 'admin',
    company_id uuid,
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Tabela vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    plate text NOT NULL,
    model text,
    year integer,
    initial_km integer DEFAULT 0,
    current_km integer DEFAULT 0,
    status text DEFAULT 'active',
    truck_type text,
    axle_count integer,
    company_id uuid,
    -- Campos de Manutenção
    maint_oil_interval integer DEFAULT 15000,
    maint_filter_interval integer DEFAULT 30000,
    maint_tyre_interval integer DEFAULT 60000,
    last_oil_change_km integer DEFAULT 0,
    last_filter_change_km integer DEFAULT 0,
    last_tyre_change_km integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Tabela drivers
CREATE TABLE IF NOT EXISTS public.drivers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    email text,
    phone text,
    license_number text,
    status text DEFAULT 'available',
    company_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 4. Tabela trips
CREATE TABLE IF NOT EXISTS public.trips (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
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
    status text DEFAULT 'pending',
    company_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 5. Tabela maintenance
CREATE TABLE IF NOT EXISTS public.maintenance (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
    type text,
    date date DEFAULT CURRENT_DATE,
    km integer,
    cost numeric DEFAULT 0,
    description text,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- 6. Tabela fuel_records
CREATE TABLE IF NOT EXISTS public.fuel_records (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
    odometer integer,
    liters numeric,
    price_per_liter numeric,
    total_value numeric,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- 7. Tabela driver_advances
CREATE TABLE IF NOT EXISTS public.driver_advances (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    date date DEFAULT CURRENT_DATE,
    description text,
    status text DEFAULT 'pending',
    company_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- 8. Tabela settings
CREATE TABLE IF NOT EXISTS public.settings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid UNIQUE,
    tax_rate numeric DEFAULT 6.0,
    commission_rate numeric DEFAULT 10.0,
    created_at timestamp with time zone DEFAULT now()
);

-- 9. Tabela tyres
CREATE TABLE IF NOT EXISTS public.tyres (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
    position text,
    serial_number text,
    brand text,
    model text,
    status text DEFAULT 'in_use',
    company_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- 10. Tabela tyre_checks
CREATE TABLE IF NOT EXISTS public.tyre_checks (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tyre_id uuid REFERENCES public.tyres(id) ON DELETE CASCADE,
    pressure numeric,
    tread_depth numeric,
    date date DEFAULT CURRENT_DATE,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

-- 11. Tabela leads
CREATE TABLE IF NOT EXISTS public.leads (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    name text,
    email text,
    phone text,
    company_name text,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS e Políticas (Simplificado para Dev)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tyre_checks ENABLE ROW LEVEL SECURITY;

-- Políticas "Allow All" para facilitar migração e teste
DROP POLICY IF EXISTS "Allow all" ON public.profiles;
CREATE POLICY "Allow all" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON public.vehicles;
CREATE POLICY "Allow all" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON public.drivers;
CREATE POLICY "Allow all" ON public.drivers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON public.trips;
CREATE POLICY "Allow all" ON public.trips FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON public.maintenance;
CREATE POLICY "Allow all" ON public.maintenance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON public.fuel_records;
CREATE POLICY "Allow all" ON public.fuel_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON public.driver_advances;
CREATE POLICY "Allow all" ON public.driver_advances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON public.settings;
CREATE POLICY "Allow all" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON public.tyres;
CREATE POLICY "Allow all" ON public.tyres FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON public.tyre_checks;
CREATE POLICY "Allow all" ON public.tyre_checks FOR ALL USING (true) WITH CHECK (true);

-- Trigger para criar profile automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
