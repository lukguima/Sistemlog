-- ============================================================
-- MIGRATION: Módulo de Agregados (terceiros prestadores de frete)
-- Data: 2026-06-23
-- Rodar no Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tabela de Agregados
CREATE TABLE IF NOT EXISTS public.agregados (
    id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name            text NOT NULL,
    document        text,           -- CPF ou CNPJ
    phone           text,
    email           text,
    vehicle_plate   text,
    vehicle_model   text,
    status          text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes           text,
    created_at      timestamptz DEFAULT NOW(),
    updated_at      timestamptz DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE public.agregados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agregados_company_policy" ON public.agregados;
CREATE POLICY "agregados_company_policy" ON public.agregados
    FOR ALL
    USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 3. Colunas adicionadas em trips para suporte a agregados
ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS driver_type   text DEFAULT 'own'
        CHECK (driver_type IN ('own', 'agregado')),
    ADD COLUMN IF NOT EXISTS agregado_id   uuid
        REFERENCES public.agregados(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS agregado_value numeric DEFAULT 0;

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_agregados_company   ON public.agregados(company_id);
CREATE INDEX IF NOT EXISTS idx_agregados_status    ON public.agregados(status);
CREATE INDEX IF NOT EXISTS idx_trips_driver_type   ON public.trips(driver_type);
CREATE INDEX IF NOT EXISTS idx_trips_agregado_id   ON public.trips(agregado_id);
