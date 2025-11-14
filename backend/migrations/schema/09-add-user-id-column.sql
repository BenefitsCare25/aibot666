-- ============================================
-- Migration: Add user_id column to employees table
-- ============================================
-- This migration adds the user_id column to all existing company schemas
-- Run this script to update existing schemas after the template has been updated

-- Company A: Add user_id column
ALTER TABLE company_a.employees
ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);

-- Create index for user_id in company_a
CREATE INDEX IF NOT EXISTS idx_company_a_employees_user_id
ON company_a.employees(user_id);

-- Company B: Add user_id column
ALTER TABLE company_b.employees
ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);

-- Create index for user_id in company_b
CREATE INDEX IF NOT EXISTS idx_company_b_employees_user_id
ON company_b.employees(user_id);

-- Add more company schemas here as needed
-- Example for additional companies:
-- ALTER TABLE company_c.employees ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);
-- CREATE INDEX IF NOT EXISTS idx_company_c_employees_user_id ON company_c.employees(user_id);

-- Verify the changes
DO $$
DECLARE
  schema_name TEXT;
BEGIN
  FOR schema_name IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname LIKE 'company_%'
  LOOP
    RAISE NOTICE 'Checking schema: %', schema_name;

    -- Check if user_id column exists
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = schema_name
        AND table_name = 'employees'
        AND column_name = 'user_id'
    ) THEN
      RAISE NOTICE '  ✓ user_id column exists in %.employees', schema_name;
    ELSE
      RAISE WARNING '  ✗ user_id column MISSING in %.employees', schema_name;
    END IF;

    -- Check if index exists
    IF EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = schema_name
        AND tablename = 'employees'
        AND indexname LIKE '%user_id%'
    ) THEN
      RAISE NOTICE '  ✓ user_id index exists in %.employees', schema_name;
    ELSE
      RAISE WARNING '  ✗ user_id index MISSING in %.employees', schema_name;
    END IF;
  END LOOP;
END $$;
