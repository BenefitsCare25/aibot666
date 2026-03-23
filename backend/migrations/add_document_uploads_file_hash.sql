-- Migration: Add file_hash and subcategory columns to document_uploads
-- Date: 2026-03-23
-- Purpose: Support duplicate file detection (SHA-256 hash) and post-upload metadata editing
--
-- Run this in Supabase SQL editor. It dynamically finds all company schemas.

DO $$
DECLARE
  schema_rec RECORD;
BEGIN
  FOR schema_rec IN
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('public', 'auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'realtime', 'supabase_functions', 'supabase_migrations', 'pgrst_config', 'information_schema', 'pg_catalog', 'pg_toast', 'vault', 'pgsodium', 'pgsodium_masks', 'net', 'cron')
    AND schema_name NOT LIKE 'pg_%'
  LOOP
    -- Skip schemas that don't have document_uploads table
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = schema_rec.schema_name AND table_name = 'document_uploads'
    ) THEN
      CONTINUE;
    END IF;

    -- Add file_hash column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = schema_rec.schema_name
      AND table_name = 'document_uploads'
      AND column_name = 'file_hash'
    ) THEN
      EXECUTE format('ALTER TABLE %I.document_uploads ADD COLUMN file_hash TEXT', schema_rec.schema_name);
      RAISE NOTICE 'Added file_hash to %.document_uploads', schema_rec.schema_name;
    END IF;

    -- Add subcategory column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = schema_rec.schema_name
      AND table_name = 'document_uploads'
      AND column_name = 'subcategory'
    ) THEN
      EXECUTE format('ALTER TABLE %I.document_uploads ADD COLUMN subcategory VARCHAR(100)', schema_rec.schema_name);
      RAISE NOTICE 'Added subcategory to %.document_uploads', schema_rec.schema_name;
    END IF;
  END LOOP;
END $$;
