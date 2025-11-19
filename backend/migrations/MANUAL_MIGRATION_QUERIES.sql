-- ========================================================
-- EMPLOYEE LIFECYCLE MIGRATION - MANUAL SQL QUERIES
-- For Supabase SQL Editor
-- ========================================================
--
-- Instructions:
-- 1. Copy this entire file
-- 2. Open Supabase Dashboard → SQL Editor
-- 3. Paste and run this script
-- 4. Verify success messages in output
--
-- This script will:
-- - Add 4 new columns to employees table in all company schemas
-- - Create performance index on is_active column
-- - Set all existing employees to active status
-- - Handle errors gracefully with notices
--
-- ========================================================

DO $$
DECLARE
    schema_record RECORD;
    affected_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Starting Employee Lifecycle Migration';
    RAISE NOTICE 'Timestamp: %', NOW();
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Loop through all company schemas (exclude system schemas)
    FOR schema_record IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN (
            'pg_catalog', 'information_schema', 'pg_toast', 'public',
            'extensions', 'auth', 'storage', 'graphql_public',
            'realtime', 'supabase_functions', 'vault', 'pgsodium'
        )
        AND schema_name NOT LIKE 'pg_%'
        ORDER BY schema_name
    LOOP
        BEGIN
            RAISE NOTICE '----------------------------------------';
            RAISE NOTICE 'Processing schema: %', schema_record.schema_name;
            RAISE NOTICE '----------------------------------------';

            -- Add is_active column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true',
                schema_record.schema_name
            );
            RAISE NOTICE '  ✓ Added column: is_active';

            -- Add deactivated_at column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL',
                schema_record.schema_name
            );
            RAISE NOTICE '  ✓ Added column: deactivated_at';

            -- Add deactivated_by column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivated_by VARCHAR(255) DEFAULT NULL',
                schema_record.schema_name
            );
            RAISE NOTICE '  ✓ Added column: deactivated_by';

            -- Add deactivation_reason column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivation_reason TEXT DEFAULT NULL',
                schema_record.schema_name
            );
            RAISE NOTICE '  ✓ Added column: deactivation_reason';

            -- Create index on is_active for performance
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_%I_employees_is_active ON %I.employees(is_active)',
                schema_record.schema_name,
                schema_record.schema_name
            );
            RAISE NOTICE '  ✓ Created index: idx_%_employees_is_active', schema_record.schema_name;

            -- Update existing employees to active (set NULL values to true)
            EXECUTE format(
                'UPDATE %I.employees SET is_active = true WHERE is_active IS NULL',
                schema_record.schema_name
            );
            RAISE NOTICE '  ✓ Updated existing employees to active status';

            affected_count := affected_count + 1;
            RAISE NOTICE '  ✅ Schema % completed successfully', schema_record.schema_name;
            RAISE NOTICE '';

        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING '  ❌ Failed to update schema %: %', schema_record.schema_name, SQLERRM;
            RAISE NOTICE '';
        END;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration Summary';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Successfully updated schemas: %', affected_count;
    RAISE NOTICE 'Failed schemas: %', error_count;
    RAISE NOTICE 'Total schemas processed: %', affected_count + error_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Migration completed at: %', NOW();
    RAISE NOTICE '========================================';
END $$;


-- ========================================================
-- VERIFICATION QUERIES
-- Run these AFTER the migration to verify success
-- ========================================================

-- 1. Check which schemas were updated
-- This should list all your company schemas with the new columns
SELECT
    table_schema,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name IN ('is_active', 'deactivated_at', 'deactivated_by', 'deactivation_reason')
GROUP BY table_schema
ORDER BY table_schema;


-- 2. Verify column details for a specific schema
-- Replace 'your_schema_name' with one of your actual schema names
/*
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'your_schema_name'  -- REPLACE THIS
AND table_name = 'employees'
AND column_name IN ('is_active', 'deactivated_at', 'deactivated_by', 'deactivation_reason')
ORDER BY column_name;
*/


-- 3. Check if all employees are marked as active
-- Replace 'your_schema_name' with one of your actual schema names
/*
SELECT
    is_active,
    COUNT(*) as employee_count
FROM your_schema_name.employees  -- REPLACE THIS
GROUP BY is_active;
*/


-- 4. List all indexes on employees table for a specific schema
-- Replace 'your_schema_name' with one of your actual schema names
/*
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'your_schema_name'  -- REPLACE THIS
AND tablename = 'employees'
ORDER BY indexname;
*/
