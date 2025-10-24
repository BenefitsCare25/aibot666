-- Create log_requests table for Company A
-- Execute this SQL in your Supabase SQL editor

-- =====================================================
-- COMPANY A - LOG REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS company_a.log_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES company_a.employees(id) ON DELETE SET NULL,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('keyword', 'button')),
  request_message TEXT,
  user_email VARCHAR(255), -- User's email for acknowledgment
  acknowledgment_sent BOOLEAN DEFAULT false, -- Whether acknowledgment email was sent
  acknowledgment_sent_at TIMESTAMPTZ, -- When acknowledgment was sent
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_company_a_log_requests_conversation_id ON company_a.log_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_a_log_requests_employee_id ON company_a.log_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_a_log_requests_created_at ON company_a.log_requests(created_at DESC);

-- Add RLS policies (if using Row Level Security)
ALTER TABLE company_a.log_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can manage log_requests"
  ON company_a.log_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE company_a.log_requests IS 'Stores LOG (conversation history + attachments) requests sent to support team via email';

-- =====================================================
-- COMPANY B - LOG REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS company_b.log_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  employee_id UUID REFERENCES company_b.employees(id) ON DELETE SET NULL,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('keyword', 'button')),
  request_message TEXT,
  user_email VARCHAR(255), -- User's email for acknowledgment
  acknowledgment_sent BOOLEAN DEFAULT false, -- Whether acknowledgment email was sent
  acknowledgment_sent_at TIMESTAMPTZ, -- When acknowledgment was sent
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_company_b_log_requests_conversation_id ON company_b.log_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_company_b_log_requests_employee_id ON company_b.log_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_company_b_log_requests_created_at ON company_b.log_requests(created_at DESC);

-- Add RLS policies (if using Row Level Security)
ALTER TABLE company_b.log_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can manage log_requests"
  ON company_b.log_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE company_b.log_requests IS 'Stores LOG (conversation history + attachments) requests sent to support team via email';
