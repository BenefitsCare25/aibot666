-- Migration: Create document_uploads table for existing company schemas
-- Date: 2026-03-23
-- Purpose: Existing schemas created before the document upload feature was added
--          do not have a document_uploads table. This migration creates it for them.
--          Safe to run multiple times (IF NOT EXISTS / column checks).
--
-- Run this in Supabase SQL editor.

DO $$
DECLARE
  schema_rec RECORD;
BEGIN
  FOR schema_rec IN
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public', 'auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'realtime', 'supabase_functions', 'supabase_migrations', 'pgrst_config', 'information_schema', 'pg_catalog', 'pg_toast', 'vault', 'pgsodium', 'pgsodium_masks', 'net', 'cron')
    AND schema_name NOT LIKE 'pg_%'
  LOOP

    -- Create document_uploads table if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = schema_rec.schema_name AND table_name = 'document_uploads'
    ) THEN
      EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.document_uploads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename VARCHAR(500) NOT NULL,
          original_name VARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL,
          page_count INTEGER,
          category VARCHAR(100),
          subcategory VARCHAR(100),
          chunk_count INTEGER DEFAULT 0,
          file_hash TEXT,
          status VARCHAR(20) NOT NULL DEFAULT ''queued'' CHECK (status IN (''queued'', ''processing'', ''completed'', ''failed'')),
          error_message TEXT,
          processing_started_at TIMESTAMP WITH TIME ZONE,
          processing_completed_at TIMESTAMP WITH TIME ZONE,
          uploaded_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
          metadata JSONB DEFAULT ''{}'',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_rec.schema_name);

      -- Indexes
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_doc_uploads_status ON %I.document_uploads(status)', replace(schema_rec.schema_name, '-', '_'), schema_rec.schema_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_doc_uploads_created_at ON %I.document_uploads(created_at DESC)', replace(schema_rec.schema_name, '-', '_'), schema_rec.schema_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_doc_uploads_category ON %I.document_uploads(category)', replace(schema_rec.schema_name, '-', '_'), schema_rec.schema_name);

      -- updated_at trigger (reuse schema's existing trigger function if present)
      IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = schema_rec.schema_name AND p.proname = 'update_updated_at_column'
      ) THEN
        EXECUTE format('
          CREATE TRIGGER update_document_uploads_updated_at
          BEFORE UPDATE ON %I.document_uploads
          FOR EACH ROW EXECUTE FUNCTION %I.update_updated_at_column()',
          schema_rec.schema_name, schema_rec.schema_name);
      END IF;

      -- Grants
      EXECUTE format('GRANT ALL ON %I.document_uploads TO postgres, anon, authenticated, service_role', schema_rec.schema_name);

      RAISE NOTICE 'Created document_uploads table in schema %', schema_rec.schema_name;

    ELSE
      -- Table exists — just ensure new columns are present (file_hash, subcategory)
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = schema_rec.schema_name AND table_name = 'document_uploads' AND column_name = 'file_hash'
      ) THEN
        EXECUTE format('ALTER TABLE %I.document_uploads ADD COLUMN file_hash TEXT', schema_rec.schema_name);
        RAISE NOTICE 'Added file_hash to %.document_uploads', schema_rec.schema_name;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = schema_rec.schema_name AND table_name = 'document_uploads' AND column_name = 'subcategory'
      ) THEN
        EXECUTE format('ALTER TABLE %I.document_uploads ADD COLUMN subcategory VARCHAR(100)', schema_rec.schema_name);
        RAISE NOTICE 'Added subcategory to %.document_uploads', schema_rec.schema_name;
      END IF;

    END IF;

  END LOOP;
END $$;
