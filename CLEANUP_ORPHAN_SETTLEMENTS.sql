-- ============================================================
-- Limpeza de settlements órfãos (viagens já excluídas)
-- Rode no SQL Editor do Supabase (uma vez por ambiente).
-- ============================================================

-- 1) Apaga acertos em que NENHUMA viagem do array existe mais
DELETE FROM public.settlements s
WHERE NOT EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = ANY (COALESCE(s.trips_ids, '{}'::uuid[]))
)
OR COALESCE(cardinality(s.trips_ids), 0) = 0;

-- 2) Remove UUIDs fantasmas do array trips_ids (mantém só viagens existentes)
UPDATE public.settlements s
SET trips_ids = COALESCE((
    SELECT array_agg(x ORDER BY x)
    FROM unnest(s.trips_ids) AS x
    WHERE EXISTS (SELECT 1 FROM public.trips t WHERE t.id = x)
), '{}'::uuid[]);

-- Após o UPDATE acima acertos que ficaram vazios
DELETE FROM public.settlements
WHERE COALESCE(cardinality(trips_ids), 0) = 0;

-- Totais (total_gross / net_paid) serão recalculados pelo app
-- via settlementService.purgeOrphanSettlements no Dashboard.

NOTIFY pgrst, 'reload schema';

SELECT 'CLEANUP_ORPHAN_SETTLEMENTS OK' AS resultado;
