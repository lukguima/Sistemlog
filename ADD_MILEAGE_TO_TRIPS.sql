-- Migration para adicionar campos de quilometragem na tabela de viagens (fretes)
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS start_km numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS end_km numeric DEFAULT 0;
