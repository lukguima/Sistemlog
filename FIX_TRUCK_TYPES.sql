-- ============================================================
-- Tipos de caminhão e implemento cadastrados pela empresa.
-- Idempotente. Rodar no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_truck_types (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('cavalo', 'implemento')),
    layout_key text NOT NULL,
    uses_implement boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT company_truck_types_name_not_blank CHECK (char_length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS company_truck_types_company_kind_name_uidx
    ON public.company_truck_types (company_id, kind, lower(name));

ALTER TABLE public.company_truck_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON public.company_truck_types;
CREATE POLICY "Allow all" ON public.company_truck_types
    FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_truck_types TO authenticated;
GRANT ALL ON public.company_truck_types TO service_role;

NOTIFY pgrst, 'reload schema';
