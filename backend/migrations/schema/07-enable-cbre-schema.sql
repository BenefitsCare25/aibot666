-- ============================================
-- STEP 7: Enable API Access to CBRE Schema
-- ============================================
-- Run this SQL in Supabase SQL Editor to grant permissions to cbre schema

-- IMPORTANT: You MUST also enable schema in Supabase Dashboard:
-- 1. Go to Settings → API → Exposed schemas
-- 2. Add 'cbre' to the list (currently has: public, graphql_public, company_a, company_b)
-- 3. Click Save
-- 4. The error "The schema must be one of the following" will disappear

-- Grant schema access to all Supabase roles
GRANT USAGE ON SCHEMA cbre TO postgres, anon, authenticated, service_role;

-- Grant permissions on all existing tables
GRANT ALL ON ALL TABLES IN SCHEMA cbre TO postgres, anon, authenticated, service_role;

-- Grant permissions on all sequences (for auto-increment IDs)
GRANT ALL ON ALL SEQUENCES IN SCHEMA cbre TO postgres, anon, authenticated, service_role;

-- Grant execute permissions on all functions (RPC calls)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cbre TO postgres, anon, authenticated, service_role;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA cbre GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cbre GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cbre GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- Verify cbre schema exists
SELECT schema_name FROM information_schema.schemata
WHERE schema_name = 'cbre';

-- Verify tables in cbre schema
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'cbre'
ORDER BY tablename;

-- Test query access (should work after enabling in Dashboard)
-- SELECT * FROM cbre.quick_questions LIMIT 5;
