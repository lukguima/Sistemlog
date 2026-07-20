-- ============================================================
-- FIX: tabela settings — colunas usadas em Configurações
-- Rode no SQL Editor do Supabase (projeto wjlcmpfzcdhgdmmripjq)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL UNIQUE,
    system_name TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#2563EB',
    modules JSONB DEFAULT '["portal", "driver_app", "monitoring"]'::jsonb,
    default_commission_rate NUMERIC DEFAULT 12,
    default_tax_rate NUMERIC DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Colunas que o app espera (idempotente)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS system_name TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#2563EB';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '["portal", "driver_app", "monitoring"]'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_commission_rate NUMERIC DEFAULT 12;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC DEFAULT 7;

-- Compatibilidade com schemas antigos (commission_rate / tax_rate / active_modules)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 12;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 7;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS active_modules JSONB;

-- Garante UNIQUE em company_id (necessário para upsert onConflict)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.settings'::regclass
          AND contype = 'u'
          AND conname LIKE '%company_id%'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'settings' AND indexdef ILIKE '%UNIQUE%company_id%'
    ) THEN
        BEGIN
            ALTER TABLE public.settings ADD CONSTRAINT settings_company_id_key UNIQUE (company_id);
        EXCEPTION WHEN duplicate_table OR duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;

-- Copia valores antigos → novos, se default_* estiver vazio
UPDATE public.settings
SET default_commission_rate = COALESCE(default_commission_rate, commission_rate, 12),
    default_tax_rate        = COALESCE(default_tax_rate, tax_rate, 7),
    modules                 = COALESCE(modules, active_modules, '["portal", "driver_app", "monitoring"]'::jsonb);

-- RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Settings isolation" ON public.settings;
CREATE POLICY "Settings isolation" ON public.settings
FOR ALL
USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid = company_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
)
WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid = company_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
);

GRANT ALL ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

-- Recarrega o cache do PostgREST (se a função existir no projeto)
NOTIFY pgrst, 'reload schema';
