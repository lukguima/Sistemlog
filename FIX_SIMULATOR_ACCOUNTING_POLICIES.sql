-- Correção: remove políticas duplicadas e recria
-- Execute no Supabase SQL Editor

DROP POLICY IF EXISTS "company_access" ON public.investment_simulations;
DROP POLICY IF EXISTS "company_access" ON public.accounting_documents;
DROP POLICY IF EXISTS "company_access" ON public.tax_obligations;
DROP POLICY IF EXISTS "company_access" ON public.business_events;

CREATE POLICY "company_access" ON public.investment_simulations
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.accounting_documents
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.tax_obligations
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "company_access" ON public.business_events
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
