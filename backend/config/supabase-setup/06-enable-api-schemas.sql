-- ============================================
-- STEP 6: Enable API Access to Custom Schemas
-- ============================================
-- This enables PostgREST API access to company schemas

-- Grant usage on schemas to the authenticator role (used by PostgREST)
-- Replace 'authenticator' with your actual Supabase authenticator role name
-- You can find this in Supabase Dashboard -> Settings -> Database -> Connection Info

-- Note: In Supabase, you need to add schemas to the API exposed schemas list
-- This is done in the Supabase Dashboard:
-- 1. Go to Settings -> API
-- 2. Under "Exposed schemas", add: company_a, company_b
-- 3. Click Save

-- Alternatively, use this SQL to check current exposed schemas:
SHOW pgrst.db_schemas;

-- To update exposed schemas, you need to modify the PostgREST configuration
-- This typically requires Supabase dashboard access or support

-- For local development, you can add to postgresql.conf:
-- pgrst.db_schemas = "public,company_a,company_b"

-- Grant necessary permissions (run this for each schema)
GRANT USAGE ON SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA company_b TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA company_b TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA company_b TO postgres, anon, authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA company_a TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA company_b TO postgres, anon, authenticated, service_role;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA company_a GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA company_b GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA company_a GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA company_b GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA company_a GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA company_b GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;
