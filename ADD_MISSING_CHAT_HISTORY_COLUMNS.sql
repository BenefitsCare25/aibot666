-- Migration: Add missing admin attendance columns to chat_history
-- Purpose: Add attended_by, admin_notes, and attended_at columns that exist in old schema
-- Run this in your self-hosted Supabase SQL Editor

-- Add columns to company_a.chat_history
ALTER TABLE company_a.chat_history
ADD COLUMN IF NOT EXISTS attended_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

-- Add columns to company_b.chat_history
ALTER TABLE company_b.chat_history
ADD COLUMN IF NOT EXISTS attended_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

-- Add columns to cbre.chat_history
ALTER TABLE cbre.chat_history
ADD COLUMN IF NOT EXISTS attended_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for filtering by attended status
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
