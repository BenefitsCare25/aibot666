-- Migration: Add admin attendance tracking to chat_history
-- Purpose: Track which admin attended/reviewed the conversation and add summary notes
-- Date: 2025-11-11

-- Add admin attendance fields to chat_history table for all companies
ALTER TABLE company_a.chat_history
ADD COLUMN IF NOT EXISTS attended_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE company_b.chat_history
ADD COLUMN IF NOT EXISTS attended_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE cbre.chat_history
ADD COLUMN IF NOT EXISTS attended_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

-- Add index for filtering conversations by attended status
CREATE INDEX IF NOT EXISTS idx_company_a_chat_attended ON company_a.chat_history(attended_by) WHERE attended_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_b_chat_attended ON company_b.chat_history(attended_by) WHERE attended_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cbre_chat_attended ON cbre.chat_history(attended_by) WHERE attended_by IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN company_a.chat_history.attended_by IS 'Name of admin who attended/reviewed this conversation';
COMMENT ON COLUMN company_a.chat_history.admin_notes IS 'Summary notes added by admin for reference';
COMMENT ON COLUMN company_a.chat_history.attended_at IS 'Timestamp when admin attended/reviewed the conversation';

COMMENT ON COLUMN company_b.chat_history.attended_by IS 'Name of admin who attended/reviewed this conversation';
COMMENT ON COLUMN company_b.chat_history.admin_notes IS 'Summary notes added by admin for reference';
COMMENT ON COLUMN company_b.chat_history.attended_at IS 'Timestamp when admin attended/reviewed the conversation';

COMMENT ON COLUMN cbre.chat_history.attended_by IS 'Name of admin who attended/reviewed this conversation';
COMMENT ON COLUMN cbre.chat_history.admin_notes IS 'Summary notes added by admin for reference';
COMMENT ON COLUMN cbre.chat_history.attended_at IS 'Timestamp when admin attended/reviewed the conversation';
