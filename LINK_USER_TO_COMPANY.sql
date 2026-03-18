-- Script to link users to the correct company that contains data
-- This ensures multi-tenancy rules are respected rather than relying on a frontend fallback.

-- 1. Identify the company containing the actual data (e.g., trips, vehicles)
-- In your database, this is: f889d593-868c-477d-b6a7-425c2e98ed84 ('Minha Empresa Principal')

-- 2. Insert missing profiles from auth.users and set the correct company_id
INSERT INTO public.profiles (id, company_id, role)
SELECT 
    id, 
    'f889d593-868c-477d-b6a7-425c2e98ed84', 
    'admin'
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET company_id = 'f889d593-868c-477d-b6a7-425c2e98ed84';

-- 3. Update auth.users metadata to match
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{company_id}',
    '"f889d593-868c-477d-b6a7-425c2e98ed84"'
)
WHERE raw_user_meta_data->>'company_id' IS NULL 
   OR raw_user_meta_data->>'company_id' = '00000000-0000-0000-0000-000000000000'
   OR raw_user_meta_data->>'company_id' = 'e2098d5f-47dc-40e1-adcc-37d402bfee38';

-- Check the result
SELECT id, company_id, role FROM public.profiles;
