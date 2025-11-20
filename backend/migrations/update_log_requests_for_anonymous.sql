-- Update log_requests table to support anonymous LOG requests
-- Execute this SQL in your Supabase SQL editor

-- =====================================================
-- COMPANY A - UPDATE LOG REQUESTS TABLE
-- =====================================================

-- 1. Allow conversation_id to be NULL for anonymous requests
ALTER TABLE company_a.log_requests
  ALTER COLUMN conversation_id DROP NOT NULL;

-- 2. Update request_type to include 'anonymous'
ALTER TABLE company_a.log_requests
  DROP CONSTRAINT IF EXISTS log_requests_request_type_check;

ALTER TABLE company_a.log_requests
  ADD CONSTRAINT log_requests_request_type_check
  CHECK (request_type IN ('keyword', 'button', 'anonymous'));

-- 3. Add metadata column for storing additional information
ALTER TABLE company_a.log_requests
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 4. Add comment for metadata column
COMMENT ON COLUMN company_a.log_requests.metadata IS 'Stores additional metadata like user_agent, ip_address, company_id for anonymous requests';

-- =====================================================
-- COMPANY B - UPDATE LOG REQUESTS TABLE
-- =====================================================

-- 1. Allow conversation_id to be NULL for anonymous requests
ALTER TABLE company_b.log_requests
  ALTER COLUMN conversation_id DROP NOT NULL;

-- 2. Update request_type to include 'anonymous'
ALTER TABLE company_b.log_requests
  DROP CONSTRAINT IF EXISTS log_requests_request_type_check;

ALTER TABLE company_b.log_requests
  ADD CONSTRAINT log_requests_request_type_check
  CHECK (request_type IN ('keyword', 'button', 'anonymous'));

-- 3. Add metadata column for storing additional information
ALTER TABLE company_b.log_requests
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 4. Add comment for metadata column
COMMENT ON COLUMN company_b.log_requests.metadata IS 'Stores additional metadata like user_agent, ip_address, company_id for anonymous requests';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these to verify the changes were applied successfully:

-- Check Company A table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'company_a'
  AND table_name = 'log_requests'
ORDER BY ordinal_position;

-- Check Company B table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'company_b'
  AND table_name = 'log_requests'
ORDER BY ordinal_position;

-- Check request_type constraints
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%request_type%';
