-- ============================================================
-- SCRIPT PARA CORRIGIR CONSTRAINT DE STATUS DE VEÍCULOS
-- Execute no SQL Editor do Supabase
-- ============================================================

DO $$ 
BEGIN 
    -- Remover a constraint antiga
    ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
    
    -- Adicionar a nova constraint permitindo Inglês e Português
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_status_check 
    CHECK (status IN ('active', 'inactive', 'maintenance', 'in_trip', 'Ativo', 'Inativo', 'Manutenção', 'Em Viagem'));

END $$;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
