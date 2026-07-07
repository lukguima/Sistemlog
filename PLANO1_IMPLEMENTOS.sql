-- ============================================================
-- PLANO 1 — IMPLEMENTOS COMO CADASTRO PRÓPRIO
-- ------------------------------------------------------------
-- Permite cadastrar implementos (carretas, reboques) como
-- registros próprios na mesma tabela vehicles, e vincular
-- um implemento à viagem além do cavalo.
--
-- Idempotente. Não altera dados existentes:
--   • toda linha atual de vehicles vira category='truck'
--   • trips.implement_id é nullable (viagens antigas seguem válidas)
-- ============================================================

-- 1. Categoria do registro em vehicles ('truck' ou 'implemento')
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'category'
    ) THEN
        ALTER TABLE public.vehicles ADD COLUMN category text DEFAULT 'truck';
    END IF;
END $$;

-- Garante que registros antigos (category NULL) fiquem como 'truck'
UPDATE public.vehicles SET category = 'truck' WHERE category IS NULL;

-- 2. Tipo do implemento (Carreta Baú, Graneleira, Sider, Prancha, Tanque, etc.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'implement_type'
    ) THEN
        ALTER TABLE public.vehicles ADD COLUMN implement_type text;
    END IF;
END $$;

-- 3. Vínculo do implemento na viagem (nullable — não obrigatório)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'trips' AND COLUMN_NAME = 'implement_id'
    ) THEN
        ALTER TABLE public.trips ADD COLUMN implement_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Colunas usadas pelo cadastro de implemento (e úteis também aos caminhões)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'tyre_count') THEN
        ALTER TABLE public.vehicles ADD COLUMN tyre_count integer DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'axle_count') THEN
        ALTER TABLE public.vehicles ADD COLUMN axle_count integer DEFAULT 0;
    END IF;
END $$;

-- ============================================================
-- Referência de tipos de implemento (documentação):
--   Carreta Baú, Carreta Graneleira, Carreta Sider,
--   Carreta Frigorífica, Prancha, Tanque, Bitrem, Rodotrem,
--   Reboque, Semirreboque
-- category='truck' → aparece em Viagens (cavalo), abastecimento, etc.
-- category='implemento' → aparece na aba Implementos e como opção
--                          de implemento na viagem.
-- ============================================================
