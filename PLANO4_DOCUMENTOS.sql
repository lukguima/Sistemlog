-- ============================================================
-- PLANO 4 — DOCUMENTOS DE CONFORMIDADE + CENTRAL DE UPLOAD
-- ------------------------------------------------------------
-- Vencimentos novos:
--   Cavalo:    CIV, Cronotacógrafo
--   Carreta:   CIV, CIPP, Aferição
--   Motorista: ASO, NR20, NR35, MOPP (CNH já existe)
-- + tabela compliance_documents (histórico/anexos PDF)
-- + bucket de storage para os arquivos
-- Idempotente. Colunas nullable — nada existente é afetado.
-- ============================================================

-- 1. Colunas de vencimento em vehicles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='civ_expiry') THEN
    ALTER TABLE public.vehicles ADD COLUMN civ_expiry date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='tacografo_expiry') THEN
    ALTER TABLE public.vehicles ADD COLUMN tacografo_expiry date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='cipp_expiry') THEN
    ALTER TABLE public.vehicles ADD COLUMN cipp_expiry date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='afericao_expiry') THEN
    ALTER TABLE public.vehicles ADD COLUMN afericao_expiry date;
  END IF;
END $$;

-- 2. Colunas de vencimento em drivers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='aso_expiry') THEN
    ALTER TABLE public.drivers ADD COLUMN aso_expiry date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='nr20_expiry') THEN
    ALTER TABLE public.drivers ADD COLUMN nr20_expiry date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='nr35_expiry') THEN
    ALTER TABLE public.drivers ADD COLUMN nr35_expiry date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='mopp_expiry') THEN
    ALTER TABLE public.drivers ADD COLUMN mopp_expiry date;
  END IF;
END $$;

-- 3. Tabela de documentos (histórico + anexo PDF)
CREATE TABLE IF NOT EXISTS public.compliance_documents (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  uuid NOT NULL,
    entity_type text NOT NULL CHECK (entity_type IN ('vehicle', 'driver')),
    entity_id   uuid NOT NULL,
    doc_type    text NOT NULL,   -- crlv, antt, civ, tacografo, cipp, afericao, cnh, aso, nr20, nr35, mopp
    expiry_date date,
    file_path   text,            -- caminho no storage
    file_name   text,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_all ON public.compliance_documents;
CREATE POLICY company_all ON public.compliance_documents
    FOR ALL TO authenticated
    USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'))
    WITH CHECK (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

-- 4. Bucket de storage para os PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-docs', 'compliance-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket: cada empresa acessa só a própria pasta (company_id/...)
DROP POLICY IF EXISTS compliance_docs_select ON storage.objects;
CREATE POLICY compliance_docs_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'compliance-docs'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    );

DROP POLICY IF EXISTS compliance_docs_insert ON storage.objects;
CREATE POLICY compliance_docs_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'compliance-docs'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    );

DROP POLICY IF EXISTS compliance_docs_delete ON storage.objects;
CREATE POLICY compliance_docs_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'compliance-docs'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    );

SELECT 'PLANO 4 APLICADO' AS resultado;
