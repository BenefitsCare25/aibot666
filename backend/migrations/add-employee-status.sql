-- Migration: Add soft delete columns to employees table
-- This migration adds status tracking columns to all company schemas

DO $$
DECLARE
    schema_record RECORD;
    affected_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting employee status migration...';

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
    LOOP
        BEGIN
            -- Add is_active column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true',
                schema_record.schema_name
            );

            -- Add deactivated_at column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL',
                schema_record.schema_name
            );

            -- Add deactivated_by column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivated_by VARCHAR(255) DEFAULT NULL',
                schema_record.schema_name
            );

            -- Add deactivation_reason column
            EXECUTE format(
                'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS deactivation_reason TEXT DEFAULT NULL',
                schema_record.schema_name
            );

            -- Create index on is_active for performance
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS idx_%I_employees_is_active ON %I.employees(is_active)',
                schema_record.schema_name,
                schema_record.schema_name
            );

            -- Update existing employees to active (set NULL values to true)
            EXECUTE format(
                'UPDATE %I.employees SET is_active = true WHERE is_active IS NULL',
                schema_record.schema_name
            );

            affected_count := affected_count + 1;
            RAISE NOTICE 'Updated schema: % (%/...)', schema_record.schema_name, affected_count;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to update schema %: %', schema_record.schema_name, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Migration completed. Affected schemas: %', affected_count;
END $$;
