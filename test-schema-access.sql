-- Test Schema Access
-- Run this in Supabase SQL Editor to verify schemas are properly configured

-- 1. Check if schemas exist
SELECT 'Schemas Found:' as status;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('public', 'company_a', 'company_b')
ORDER BY schema_name;

-- 2. Check tables in each schema
SELECT 'Company A Tables:' as status;
SELECT tablename
FROM pg_tables
WHERE schemaname = 'company_a'
ORDER BY tablename;

SELECT 'Company B Tables:' as status;
SELECT tablename
FROM pg_tables
WHERE schemaname = 'company_b'
ORDER BY tablename;

-- 3. Test data access
SELECT '=== Company A Data ===' as test;
SELECT employee_id, name, email, policy_type
FROM company_a.employees
LIMIT 3;

SELECT '=== Company B Data ===' as test;
SELECT employee_id, name, email, policy_type
FROM company_b.employees
LIMIT 3;

-- 4. Check permissions
SELECT '=== Schema Permissions ===' as test;
SELECT
  n.nspname as schema_name,
  r.rolname as role_name,
  has_schema_privilege(r.rolname, n.nspname, 'USAGE') as has_usage
FROM pg_namespace n
CROSS JOIN pg_roles r
WHERE n.nspname IN ('company_a', 'company_b')
  AND r.rolname IN ('postgres', 'anon', 'authenticated', 'service_role')
ORDER BY n.nspname, r.rolname;

-- If all queries above work, your schemas are properly set up
-- Next step: Expose them in Dashboard → Settings → API → "Exposed schemas"
