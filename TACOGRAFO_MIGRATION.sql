-- =====================================================
-- MIGRAÇÃO: Aferição de Tacógrafo (controle por data)
-- Execute no Supabase SQL Editor
-- =====================================================

ALTER TABLE public.maintenance
    ADD COLUMN IF NOT EXISTS next_maintenance_date date,
    ADD COLUMN IF NOT EXISTS maintenance_interval_months integer;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
