-- ==========================================
-- SCRIPT DE DIAGNÓSTICO DE MULTI-TENANCY
-- Execute este script no SQL Editor do Supabase
-- ==========================================

-- 1. Ver se existem empresas cadastradas
SELECT id, name FROM public.companies;

-- 2. Ver o perfil do usuário logado (Substitua o email se souber ou rode para ver todos)
SELECT id, email, company_id FROM public.profiles;

-- 3. Ver detalhes da constraint de chave estrangeira
SELECT
    conname AS constraint_name,
    confrelid::regclass AS referenced_table,
    af.attname AS referencing_column,
    rt.attname AS referenced_column
FROM
    pg_constraint c
JOIN
    pg_attribute af ON af.attnum = ANY(c.conkey) AND af.attrelid = c.conrelid
JOIN
    pg_attribute rt ON rt.attnum = ANY(c.confkey) AND rt.attrelid = c.confrelid
WHERE
    c.conrelid = 'public.drivers'::regclass
    AND c.conname = 'drivers_company_id_fkey';
