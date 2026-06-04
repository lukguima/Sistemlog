-- Migration: Tipos de manutenção preventiva por empresa
-- Execute no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.preventive_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    value text NOT NULL,
    control_type text NOT NULL DEFAULT 'km', -- 'km' ou 'date'
    default_interval integer DEFAULT 0,      -- KM ou meses dependendo de control_type
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.preventive_types ENABLE ROW LEVEL SECURITY;

-- RLS: empresa só vê/altera os próprios tipos
CREATE POLICY "preventive_types_company_all" ON public.preventive_types
    FOR ALL
    USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Índice para performance
CREATE INDEX IF NOT EXISTS preventive_types_company_idx ON public.preventive_types (company_id);
