-- Migration: Add callback_requests table to all company schemas
-- Run this migration to add callback request functionality to existing companies

-- This migration will create the callback_requests table in all existing company schemas
-- Usage: Run this SQL in your Supabase SQL editor or via migration tool

DO $$
DECLARE
  schema_record RECORD;
  schema_sql TEXT;
BEGIN
  -- Loop through all company schemas (schemas that start with 'company_')
  FOR schema_record IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'company_%'
  LOOP
    -- Build the SQL to create callback_requests table in each schema
    schema_sql := format('
      -- Callback requests table: Store callback requests from users who cannot login
      CREATE TABLE IF NOT EXISTS %I.callback_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_number VARCHAR(50) NOT NULL,
        employee_id VARCHAR(50),
        status VARCHAR(20) DEFAULT ''pending'' CHECK (status IN (''pending'', ''contacted'', ''resolved'', ''failed'')),
        email_sent BOOLEAN DEFAULT false,
        email_sent_at TIMESTAMP WITH TIME ZONE,
        email_error TEXT,
        telegram_sent BOOLEAN DEFAULT false,
        telegram_sent_at TIMESTAMP WITH TIME ZONE,
        telegram_error TEXT,
        notes TEXT,
        contacted_at TIMESTAMP WITH TIME ZONE,
        contacted_by VARCHAR(255),
        metadata JSONB DEFAULT ''{}''::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create indexes for callback requests
      CREATE INDEX IF NOT EXISTS idx_%I_callback_status ON %I.callback_requests(status);
      CREATE INDEX IF NOT EXISTS idx_%I_callback_created ON %I.callback_requests(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_%I_callback_employee ON %I.callback_requests(employee_id);
    ',
      schema_record.schema_name,
      replace(schema_record.schema_name, '.', '_'),
      schema_record.schema_name,
      replace(schema_record.schema_name, '.', '_'),
      schema_record.schema_name,
      replace(schema_record.schema_name, '.', '_'),
      schema_record.schema_name
    );

    -- Execute the SQL
    EXECUTE schema_sql;

    RAISE NOTICE 'Added callback_requests table to schema: %', schema_record.schema_name;
  END LOOP;

  RAISE NOTICE 'Migration completed successfully';
END $$;

-- Add callback email columns to companies table in public schema
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS callback_email_to VARCHAR(500),
ADD COLUMN IF NOT EXISTS callback_email_cc VARCHAR(500);

COMMENT ON COLUMN public.companies.callback_email_to IS 'Email addresses to receive callback request notifications (comma-separated)';
COMMENT ON COLUMN public.companies.callback_email_cc IS 'CC email addresses for callback notifications (comma-separated)';
