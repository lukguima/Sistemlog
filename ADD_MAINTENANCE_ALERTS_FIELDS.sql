-- Adicionar colunas para suporte a alertas de manutenção preventiva baseados em quilometragem
ALTER TABLE public.maintenance 
ADD COLUMN IF NOT EXISTS preventive_type text,
ADD COLUMN IF NOT EXISTS next_maintenance_km numeric,
ADD COLUMN IF NOT EXISTS maintenance_interval numeric;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.maintenance.preventive_type IS 'Tipo da preventiva: óleo, filtros, correias, etc';
COMMENT ON COLUMN public.maintenance.next_maintenance_km IS 'Quilometragem prevista para a próxima manutenção deste tipo';
COMMENT ON COLUMN public.maintenance.maintenance_interval IS 'Intervalo de quilometragem recomendado entre manutenções deste tipo';
