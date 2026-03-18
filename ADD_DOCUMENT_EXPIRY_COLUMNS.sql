-- Adicionar campos de vencimento de documentos em drivers e vehicles

-- Tabela de Motoristas
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_expiry DATE;

-- Tabela de Veículos
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS document_expiry DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS antt_expiry DATE;
