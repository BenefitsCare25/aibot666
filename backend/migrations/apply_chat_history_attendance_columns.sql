-- Migration: Add admin attendance columns to existing chat_history tables
-- This ensures all existing company schemas have the attended_by columns
-- Date: 2025-11-14

-- Apply to CBRE schema
ALTER TABLE cbre.chat_history
ADD COLUMN IF NOT EXISTS attended_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_cbre_chat_attended ON cbre.chat_history(attended_by) WHERE attended_by IS NOT NULL;

COMMENT ON COLUMN cbre.chat_history.attended_by IS 'Name of admin who attended/reviewed this conversation';
COMMENT ON COLUMN cbre.chat_history.admin_notes IS 'Summary notes added by admin for reference';
COMMENT ON COLUMN cbre.chat_history.attended_at IS 'Timestamp when admin attended/reviewed the conversation';

-- Apply to Company A schema (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'company_a') THEN
    ALTER TABLE company_a.chat_history
    ADD COLUMN IF NOT EXISTS attended_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

    CREATE INDEX IF NOT EXISTS idx_company_a_chat_attended ON company_a.chat_history(attended_by) WHERE attended_by IS NOT NULL;

    COMMENT ON COLUMN company_a.chat_history.attended_by IS 'Name of admin who attended/reviewed this conversation';
    COMMENT ON COLUMN company_a.chat_history.admin_notes IS 'Summary notes added by admin for reference';
    COMMENT ON COLUMN company_a.chat_history.attended_at IS 'Timestamp when admin attended/reviewed the conversation';
  END IF;
END $$;

-- Apply to Company B schema (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'company_b') THEN
    ALTER TABLE company_b.chat_history
    ADD COLUMN IF NOT EXISTS attended_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

    CREATE INDEX IF NOT EXISTS idx_company_b_chat_attended ON company_b.chat_history(attended_by) WHERE attended_by IS NOT NULL;

    COMMENT ON COLUMN company_b.chat_history.attended_by IS 'Name of admin who attended/reviewed this conversation';
    COMMENT ON COLUMN company_b.chat_history.admin_notes IS 'Summary notes added by admin for reference';
    COMMENT ON COLUMN company_b.chat_history.attended_at IS 'Timestamp when admin attended/reviewed the conversation';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully applied chat_history attendance columns to all existing schemas';
END $$;
