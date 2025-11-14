-- ============================================
-- STEP 6: Enable API Access to Custom Schemas
-- ============================================
-- Run this SQL in Supabase SQL Editor to grant permissions

-- IMPORTANT: You MUST also enable schemas in Supabase Dashboard:
-- 1. Go to Settings → API
-- 2. Under "Exposed schemas", add: company_a, company_b
-- 3. Click Save

-- Grant schema access to all Supabase roles
GRANT USAGE ON SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA company_b TO postgres, anon, authenticated, service_role;

-- Grant permissions on all existing tables
GRANT ALL ON ALL TABLES IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA company_b TO postgres, anon, authenticated, service_role;

-- Grant permissions on all sequences (for auto-increment IDs)
GRANT ALL ON ALL SEQUENCES IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA company_b TO postgres, anon, authenticated, service_role;

-- Grant execute permissions on all functions (RPC calls)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA company_b TO postgres, anon, authenticated, service_role;

-- Set default privileges for future objects
-- Any new tables created will automatically get these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA company_a GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA company_b GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA company_a GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA company_b GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA company_a GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA company_b GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- Verify schemas exist
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('company_a', 'company_b')
ORDER BY schema_name;

-- Verify tables in each schema
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname IN ('company_a', 'company_b')
ORDER BY schemaname, tablename;

-- Test query access (should return data if permissions are correct)
-- SELECT * FROM company_a.employees LIMIT 1;
-- SELECT * FROM company_b.employees LIMIT 1;
