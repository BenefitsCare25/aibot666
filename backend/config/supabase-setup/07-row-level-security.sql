-- Row-Level Security (RLS) Policies
-- Ensures employees can only access their own data
-- CRITICAL SECURITY: Prevents accidental data leakage at database level

-- ==========================================
-- COMPANY A - Row-Level Security
-- ==========================================

-- Enable RLS on employees table
ALTER TABLE company_a.employees ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only read their own record
-- Uses auth.uid() which should be set by application via SET LOCAL
CREATE POLICY "employees_select_own_record" ON company_a.employees
  FOR SELECT
  USING (id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Service role can access all employees (for admin operations)
CREATE POLICY "employees_service_role_all" ON company_a.employees
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- Enable RLS on chat_history table
ALTER TABLE company_a.chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only access their own chat history
CREATE POLICY "chat_history_select_own_records" ON company_a.chat_history
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Employees can only insert their own messages
CREATE POLICY "chat_history_insert_own_records" ON company_a.chat_history
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Service role can access all chat history (for admin/analytics)
CREATE POLICY "chat_history_service_role_all" ON company_a.chat_history
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- Enable RLS on escalations table
ALTER TABLE company_a.escalations ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only view their own escalations
CREATE POLICY "escalations_select_own_records" ON company_a.escalations
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Employees can only create escalations for themselves
CREATE POLICY "escalations_insert_own_records" ON company_a.escalations
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Service role can manage all escalations (for HITL workflow)
CREATE POLICY "escalations_service_role_all" ON company_a.escalations
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- Enable RLS on employee_embeddings table
ALTER TABLE company_a.employee_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access embeddings (prevent direct employee access)
CREATE POLICY "employee_embeddings_service_role_only" ON company_a.employee_embeddings
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- ==========================================
-- COMPANY B - Row-Level Security
-- ==========================================

-- Enable RLS on employees table
ALTER TABLE company_b.employees ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only read their own record
CREATE POLICY "employees_select_own_record" ON company_b.employees
  FOR SELECT
  USING (id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Service role can access all employees
CREATE POLICY "employees_service_role_all" ON company_b.employees
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- Enable RLS on chat_history table
ALTER TABLE company_b.chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only access their own chat history
CREATE POLICY "chat_history_select_own_records" ON company_b.chat_history
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Employees can only insert their own messages
CREATE POLICY "chat_history_insert_own_records" ON company_b.chat_history
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Service role can access all chat history
CREATE POLICY "chat_history_service_role_all" ON company_b.chat_history
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- Enable RLS on escalations table
ALTER TABLE company_b.escalations ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can only view their own escalations
CREATE POLICY "escalations_select_own_records" ON company_b.escalations
  FOR SELECT
  USING (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Employees can only create escalations for themselves
CREATE POLICY "escalations_insert_own_records" ON company_b.escalations
  FOR INSERT
  WITH CHECK (employee_id = current_setting('app.current_employee_id', true)::uuid);

-- Policy: Service role can manage all escalations
CREATE POLICY "escalations_service_role_all" ON company_b.escalations
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- Enable RLS on employee_embeddings table
ALTER TABLE company_b.employee_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access embeddings
CREATE POLICY "employee_embeddings_service_role_only" ON company_b.employee_embeddings
  FOR ALL
  USING (current_setting('app.service_role', true)::boolean = true);

-- ==========================================
-- USAGE NOTES
-- ==========================================
--
-- Application must set session variables before queries:
--
-- For employee queries:
--   SET LOCAL app.current_employee_id = 'uuid-here';
--
-- For service/admin operations:
--   SET LOCAL app.service_role = true;
--
-- These settings are automatically reset after each transaction,
-- preventing leakage between requests.
--
-- ==========================================
