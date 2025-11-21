-- ============================================================================
-- PDF DOCUMENT UPLOAD SYSTEM - DATABASE MIGRATION
-- ============================================================================
-- This migration adds support for PDF document uploads to the knowledge base
--
-- Changes:
-- 1. Creates document_uploads table in each company schema
-- 2. Adds document_id column to knowledge_base table (link to source document)
-- 3. Adds indexes for performance
--
-- Schemas affected: company_a, company_b, cbre
-- Last Updated: 2025-01-21
-- ============================================================================

-- ============================================================================
-- COMPANY_A SCHEMA
-- ============================================================================

-- Create document_uploads table
CREATE TABLE IF NOT EXISTS company_a.document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  page_count INTEGER,
  category VARCHAR(100),
  chunk_count INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  error_message TEXT,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  uploaded_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for document_uploads
CREATE INDEX IF NOT EXISTS idx_company_a_doc_uploads_status ON company_a.document_uploads(status);
CREATE INDEX IF NOT EXISTS idx_company_a_doc_uploads_uploaded_by ON company_a.document_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_company_a_doc_uploads_created_at ON company_a.document_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_a_doc_uploads_category ON company_a.document_uploads(category);

-- Add document_id column to knowledge_base (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'company_a'
    AND table_name = 'knowledge_base'
    AND column_name = 'document_id'
  ) THEN
    ALTER TABLE company_a.knowledge_base
    ADD COLUMN document_id UUID REFERENCES company_a.document_uploads(id) ON DELETE CASCADE;

    CREATE INDEX idx_company_a_kb_document_id ON company_a.knowledge_base(document_id);
  END IF;
END $$;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION company_a.update_document_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_uploads_updated_at ON company_a.document_uploads;
CREATE TRIGGER trigger_document_uploads_updated_at
  BEFORE UPDATE ON company_a.document_uploads
  FOR EACH ROW
  EXECUTE FUNCTION company_a.update_document_uploads_updated_at();

-- ============================================================================
-- COMPANY_B SCHEMA
-- ============================================================================

-- Create document_uploads table
CREATE TABLE IF NOT EXISTS company_b.document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  page_count INTEGER,
  category VARCHAR(100),
  chunk_count INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  error_message TEXT,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  uploaded_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for document_uploads
CREATE INDEX IF NOT EXISTS idx_company_b_doc_uploads_status ON company_b.document_uploads(status);
CREATE INDEX IF NOT EXISTS idx_company_b_doc_uploads_uploaded_by ON company_b.document_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_company_b_doc_uploads_created_at ON company_b.document_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_b_doc_uploads_category ON company_b.document_uploads(category);

-- Add document_id column to knowledge_base (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'company_b'
    AND table_name = 'knowledge_base'
    AND column_name = 'document_id'
  ) THEN
    ALTER TABLE company_b.knowledge_base
    ADD COLUMN document_id UUID REFERENCES company_b.document_uploads(id) ON DELETE CASCADE;

    CREATE INDEX idx_company_b_kb_document_id ON company_b.knowledge_base(document_id);
  END IF;
END $$;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION company_b.update_document_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_uploads_updated_at ON company_b.document_uploads;
CREATE TRIGGER trigger_document_uploads_updated_at
  BEFORE UPDATE ON company_b.document_uploads
  FOR EACH ROW
  EXECUTE FUNCTION company_b.update_document_uploads_updated_at();

-- ============================================================================
-- CBRE SCHEMA
-- ============================================================================

-- Create document_uploads table
CREATE TABLE IF NOT EXISTS cbre.document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  page_count INTEGER,
  category VARCHAR(100),
  chunk_count INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  error_message TEXT,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  uploaded_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for document_uploads
CREATE INDEX IF NOT EXISTS idx_cbre_doc_uploads_status ON cbre.document_uploads(status);
CREATE INDEX IF NOT EXISTS idx_cbre_doc_uploads_uploaded_by ON cbre.document_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_cbre_doc_uploads_created_at ON cbre.document_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbre_doc_uploads_category ON cbre.document_uploads(category);

-- Add document_id column to knowledge_base (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'cbre'
    AND table_name = 'knowledge_base'
    AND column_name = 'document_id'
  ) THEN
    ALTER TABLE cbre.knowledge_base
    ADD COLUMN document_id UUID REFERENCES cbre.document_uploads(id) ON DELETE CASCADE;

    CREATE INDEX idx_cbre_kb_document_id ON cbre.knowledge_base(document_id);
  END IF;
END $$;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION cbre.update_document_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_uploads_updated_at ON cbre.document_uploads;
CREATE TRIGGER trigger_document_uploads_updated_at
  BEFORE UPDATE ON cbre.document_uploads
  FOR EACH ROW
  EXECUTE FUNCTION cbre.update_document_uploads_updated_at();

-- ============================================================================
-- VERIFICATION & COMMENTS
-- ============================================================================

-- Add helpful comments
COMMENT ON TABLE company_a.document_uploads IS 'Tracks PDF documents uploaded for knowledge base extraction';
COMMENT ON TABLE company_b.document_uploads IS 'Tracks PDF documents uploaded for knowledge base extraction';
COMMENT ON TABLE cbre.document_uploads IS 'Tracks PDF documents uploaded for knowledge base extraction';

COMMENT ON COLUMN company_a.document_uploads.status IS 'Processing status: queued (waiting), processing (in progress), completed (success), failed (error)';
COMMENT ON COLUMN company_b.document_uploads.status IS 'Processing status: queued (waiting), processing (in progress), completed (success), failed (error)';
COMMENT ON COLUMN cbre.document_uploads.status IS 'Processing status: queued (waiting), processing (in progress), completed (success), failed (error)';

-- Verification query (run after migration)
-- SELECT
--   'company_a' as schema,
--   (SELECT COUNT(*) FROM company_a.document_uploads) as document_count,
--   (SELECT COUNT(*) FROM company_a.knowledge_base WHERE document_id IS NOT NULL) as chunks_from_documents
-- UNION ALL
-- SELECT
--   'company_b',
--   (SELECT COUNT(*) FROM company_b.document_uploads),
--   (SELECT COUNT(*) FROM company_b.knowledge_base WHERE document_id IS NOT NULL)
-- UNION ALL
-- SELECT
--   'cbre',
--   (SELECT COUNT(*) FROM cbre.document_uploads),
--   (SELECT COUNT(*) FROM cbre.knowledge_base WHERE document_id IS NOT NULL);
