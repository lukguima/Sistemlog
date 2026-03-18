-- ============================================================
-- ADICIONAR VÍNCULO DE FORNECEDOR EM ABASTECIMENTO E MANUTENÇÃO
-- ============================================================

-- 1. Adicionar coluna na tabela de abastecimentos
ALTER TABLE public.fuel_records 
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

-- 2. Adicionar coluna na tabela de manutenção
ALTER TABLE public.maintenance 
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

-- 3. Comentários para documentação
COMMENT ON COLUMN public.fuel_records.supplier_id IS 'ID do fornecedor de combustível (tabela suppliers)';
COMMENT ON COLUMN public.maintenance.supplier_id IS 'ID do fornecedor de peças ou oficina (tabela suppliers)';
