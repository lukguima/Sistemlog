-- Adicionar colunas de custos na tabela de viagens
ALTER TABLE trips ADD COLUMN IF NOT EXISTS tolls_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS insurance_value DECIMAL(10,2) DEFAULT 0;

-- Adicionar coluna de seguro fixo na tabela de veículos
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_value DECIMAL(10,2) DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN trips.tolls_value IS 'Valor total dos pedágios da viagem';
COMMENT ON COLUMN trips.insurance_value IS 'Valor do seguro específico da viagem ou carga';
COMMENT ON COLUMN vehicles.insurance_value IS 'Valor do seguro fixo mensal ou anual do veículo';
