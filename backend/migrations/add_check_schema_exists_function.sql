-- Migration: Add check_schema_exists function
-- This function checks if a PostgreSQL schema exists in the database

CREATE OR REPLACE FUNCTION public.check_schema_exists(p_schema_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = p_schema_name
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_schema_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_schema_exists(text) TO service_role;
