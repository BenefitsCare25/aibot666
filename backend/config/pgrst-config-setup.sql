-- ============================================================
-- PostgREST In-Database Config Setup
-- Run this ONCE in Supabase Studio SQL Editor
-- Enables automatic schema exposure when new companies are created
-- ============================================================

-- Step 1: Create config schema
CREATE SCHEMA IF NOT EXISTS pgrst_config;

-- Step 2: Create table to store exposed schema names
CREATE TABLE IF NOT EXISTS pgrst_config.db_schemas (
  schema_name TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Seed with standard Supabase schemas
INSERT INTO pgrst_config.db_schemas (schema_name) VALUES
  ('public'),
  ('storage'),
  ('graphql_public')
ON CONFLICT DO NOTHING;

-- Step 4: Seed with all existing company schemas from companies table
INSERT INTO pgrst_config.db_schemas (schema_name)
SELECT schema_name FROM public.companies
ON CONFLICT DO NOTHING;

-- Step 5: Create pre-config function PostgREST calls on startup + reload
CREATE OR REPLACE FUNCTION pgrst_config.pre_config()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  schemas TEXT;
BEGIN
  SELECT string_agg(schema_name, ', ' ORDER BY schema_name)
  INTO schemas
  FROM pgrst_config.db_schemas;

  PERFORM set_config('pgrst.db_schemas', schemas, false);
END;
$$;

-- Step 6: Grant access to authenticator role (used by PostgREST)
GRANT USAGE ON SCHEMA pgrst_config TO authenticator;
GRANT SELECT ON pgrst_config.db_schemas TO authenticator;
GRANT EXECUTE ON FUNCTION pgrst_config.pre_config() TO authenticator;

-- Verify setup: check what schemas will be exposed
SELECT string_agg(schema_name, ', ' ORDER BY schema_name) AS schemas_to_expose
FROM pgrst_config.db_schemas;
