-- Garante que todas as colunas necessárias existam com os nomes corretos (Inglês)
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS type text DEFAULT 'preventive';
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS date timestamp with time zone DEFAULT now();
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS km numeric;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS workshop text;
ALTER TABLE public.maintenance ADD COLUMN IF NOT EXISTS notes text;

-- Garante que o tipo da coluna date esteja correto caso já exista como date simples
DO $$ 
BEGIN 
    ALTER TABLE public.maintenance ALTER COLUMN date TYPE timestamp with time zone;
EXCEPTION 
    WHEN others THEN NULL; 
END $$;

-- Força o Supabase a atualizar o cache do Schema (PostgREST)
NOTIFY pgrst, 'reload schema';
