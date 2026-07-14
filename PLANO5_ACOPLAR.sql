-- ============================================================
-- PLANO 5 — ENGATE PERSISTENTE (Acoplar cavalo + implemento)
-- ------------------------------------------------------------
-- vehicles.current_implement_id = implemento acoplado AGORA.
-- Índice único garante que uma carreta só engata em um cavalo
-- por vez (mesmo com cliques simultâneos).
-- Idempotente. Nullable — nada existente é afetado.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='vehicles' AND column_name='current_implement_id'
  ) THEN
    ALTER TABLE public.vehicles
      ADD COLUMN current_implement_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Uma carreta em apenas um cavalo por vez (trava no banco)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicles_current_implement
  ON public.vehicles (current_implement_id)
  WHERE current_implement_id IS NOT NULL;

SELECT 'PLANO 5 APLICADO' AS resultado;
