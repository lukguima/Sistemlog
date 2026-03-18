-- Script para adicionar a coluna 'odometer' na tabela fuel_records caso ela não exista.
-- Esta coluna foi referenciada no dashboard, mas parecia estar faltando no seu banco atual (causando o erro 42703).

ALTER TABLE public.fuel_records ADD COLUMN IF NOT EXISTS odometer numeric;
