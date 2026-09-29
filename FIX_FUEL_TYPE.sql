-- ============================================================
-- Tipo de combustível no abastecimento do painel.
-- Valores: diesel, gasolina, etanol. Padrão diesel.
-- Lançamentos antigos e os do motorista/posto permanecem diesel.
-- Não apaga registros. Rode no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.fuel_records
    ADD COLUMN IF NOT EXISTS fuel_type text;

UPDATE public.fuel_records
SET fuel_type = CASE
    WHEN lower(trim(fuel_type)) = 'gasolina' THEN 'gasolina'
    WHEN lower(trim(fuel_type)) = 'etanol' THEN 'etanol'
    ELSE 'diesel'
END;

ALTER TABLE public.fuel_records
    ALTER COLUMN fuel_type SET DEFAULT 'diesel';

ALTER TABLE public.fuel_records
    ALTER COLUMN fuel_type SET NOT NULL;

ALTER TABLE public.fuel_records
    DROP CONSTRAINT IF EXISTS fuel_records_fuel_type_check;

ALTER TABLE public.fuel_records
    ADD CONSTRAINT fuel_records_fuel_type_check
    CHECK (fuel_type IN ('diesel', 'gasolina', 'etanol'));
