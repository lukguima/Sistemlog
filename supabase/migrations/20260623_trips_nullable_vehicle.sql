-- Permite vehicle_id e driver_id nulos em trips (necessário para viagens de agregado)
ALTER TABLE public.trips ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE public.trips ALTER COLUMN driver_id  DROP NOT NULL;
