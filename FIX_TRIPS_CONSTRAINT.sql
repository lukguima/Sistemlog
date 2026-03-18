-- ============================================================
-- SCRIPT PARA CORRIGIR CONSTRAINT DE STATUS DE VIAGENS
-- ============================================================

DO $$ 
BEGIN 
    -- Remover a constraint antiga se ela existir
    -- O nome padrão no Postgres costuma ser 'trips_status_check'
    ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_status_check;
    
    -- Adicionar a nova constraint com todos os status necessários
    ALTER TABLE public.trips ADD CONSTRAINT trips_status_check 
    CHECK (status IN ('pending', 'in_transit', 'completed', 'validated', 'paid', 'Concluído', 'Em Trânsito', 'Pendente'));

END $$;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
