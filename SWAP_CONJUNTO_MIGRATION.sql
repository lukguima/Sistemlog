-- =====================================================
-- MIGRAÇÃO: Histórico de Troca de Conjunto (Cavalo)
-- Execute no Supabase SQL Editor
-- =====================================================

-- 1. Tabela de histórico de implementos por cavalo
CREATE TABLE IF NOT EXISTS public.vehicle_implement_history (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id      uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    vehicle_id      uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
    implement_plate_1 text,
    implement_plate_2 text,
    started_at      timestamptz NOT NULL DEFAULT now(),
    ended_at        timestamptz,        -- NULL = ainda ativo
    notes           text,
    created_at      timestamptz DEFAULT now()
);

-- 2. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_vih_vehicle_id   ON public.vehicle_implement_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vih_company_id   ON public.vehicle_implement_history(company_id);
CREATE INDEX IF NOT EXISTS idx_vih_started_at   ON public.vehicle_implement_history(started_at DESC);

-- 3. RLS
ALTER TABLE public.vehicle_implement_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_access_vih" ON public.vehicle_implement_history;
CREATE POLICY "company_access_vih" ON public.vehicle_implement_history
    USING (
        company_id = (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 4. Popula registros iniciais para cavalos que já têm implementos cadastrados
--    (cria o primeiro registro do histórico com data de hoje)
INSERT INTO public.vehicle_implement_history (company_id, vehicle_id, implement_plate_1, implement_plate_2, started_at)
SELECT
    company_id,
    id AS vehicle_id,
    implement_plate_1,
    implement_plate_2,
    now() AS started_at
FROM public.vehicles
WHERE
    truck_type IN ('CAVALO_2E', 'CAVALO_3E', 'BITREM', 'RODOTREM')
    AND (implement_plate_1 IS NOT NULL OR implement_plate_2 IS NOT NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
