-- ============================================
-- STEP 8: Schema Activity Logs
-- ============================================
-- This creates the activity logging table for tracking schema creation/deletion operations

-- Schema activity logs table: Track all schema management operations
CREATE TABLE IF NOT EXISTS public.schema_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL CHECK (action IN ('create_schema', 'delete_schema', 'rollback_creation')),
  schema_name VARCHAR(63) NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  admin_user VARCHAR(255), -- Email or identifier of admin who performed the action
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
  error_message TEXT, -- Store error details if operation failed
  metadata JSONB DEFAULT '{}', -- Additional context (e.g., duration, SQL executed)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_schema_logs_schema_name ON public.schema_activity_logs(schema_name);
CREATE INDEX IF NOT EXISTS idx_schema_logs_company_id ON public.schema_activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_schema_logs_action ON public.schema_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_schema_logs_status ON public.schema_activity_logs(status);
CREATE INDEX IF NOT EXISTS idx_schema_logs_created_at ON public.schema_activity_logs(created_at DESC);

-- Function to get latest schema activity for a company
CREATE OR REPLACE FUNCTION get_schema_activity_by_company(company_uuid UUID)
RETURNS TABLE (
  log_id UUID,
  action VARCHAR,
  schema_name VARCHAR,
  admin_user VARCHAR,
  status VARCHAR,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.action,
    l.schema_name,
    l.admin_user,
    l.status,
    l.error_message,
    l.created_at,
    l.completed_at
  FROM public.schema_activity_logs l
  WHERE l.company_id = company_uuid
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent failed operations
CREATE OR REPLACE FUNCTION get_failed_schema_operations(days_ago INTEGER DEFAULT 7)
RETURNS TABLE (
  log_id UUID,
  action VARCHAR,
  schema_name VARCHAR,
  company_id UUID,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.action,
    l.schema_name,
    l.company_id,
    l.error_message,
    l.created_at
  FROM public.schema_activity_logs l
  WHERE
    l.status = 'failed' AND
    l.created_at >= NOW() - (days_ago || ' days')::INTERVAL
  ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security for activity logs
ALTER TABLE public.schema_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can see all logs
CREATE POLICY schema_logs_admin_all ON public.schema_activity_logs
  FOR ALL
  USING (true);

-- Verify table was created
SELECT COUNT(*) as total_logs FROM public.schema_activity_logs;
