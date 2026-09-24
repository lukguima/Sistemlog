-- ============================================================
-- ARLA puro pode repetir o hodômetro de um diesel já lançado.
-- A unicidade (veículo + odômetro) passa a valer só para diesel
-- (litros > 0). Não apaga registros.
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.fuel_records
    DROP CONSTRAINT IF EXISTS fuel_records_vehicle_odometer_unique;

DROP INDEX IF EXISTS public.fuel_records_vehicle_odometer_unique;
DROP INDEX IF EXISTS public.idx_fuel_vehicle_odometer;
DROP INDEX IF EXISTS public.fuel_records_vehicle_odometer_diesel_unique;

CREATE UNIQUE INDEX fuel_records_vehicle_odometer_diesel_unique
    ON public.fuel_records (vehicle_id, odometer)
    WHERE COALESCE(liters, 0) > 0;
