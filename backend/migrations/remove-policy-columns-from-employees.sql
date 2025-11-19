-- ============================================
-- Remove Policy-Related Columns from Employees Table
-- ============================================
-- Security Enhancement: Remove sensitive policy data from chatbot database
-- Employees access policy information through their own employee portal
-- Created: 2025-11-19

-- This migration removes the following columns from all company schemas:
-- - department
-- - policy_type
-- - coverage_limit
-- - annual_claim_limit
-- - outpatient_limit
-- - dental_limit
-- - optical_limit
-- - policy_start_date
-- - policy_end_date
-- - dependents

-- ============================================
-- IMPORTANT: Run this for each company schema
-- Replace {{SCHEMA_NAME}} with actual schema names
-- Example schemas: company_a, company_b, cbre
-- ============================================

-- Drop columns from employees table
ALTER TABLE {{SCHEMA_NAME}}.employees
  DROP COLUMN IF EXISTS department,
  DROP COLUMN IF EXISTS policy_type,
  DROP COLUMN IF EXISTS coverage_limit,
  DROP COLUMN IF EXISTS annual_claim_limit,
  DROP COLUMN IF EXISTS outpatient_limit,
  DROP COLUMN IF EXISTS dental_limit,
  DROP COLUMN IF EXISTS optical_limit,
  DROP COLUMN IF EXISTS policy_start_date,
  DROP COLUMN IF EXISTS policy_end_date,
  DROP COLUMN IF EXISTS dependents;

-- Verify columns have been removed
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = '{{SCHEMA_NAME}}'
  AND table_name = 'employees'
ORDER BY ordinal_position;

-- ============================================
-- Expected remaining columns:
-- - id (uuid)
-- - employee_id (varchar)
-- - user_id (varchar)
-- - name (varchar)
-- - email (varchar)
-- - metadata (jsonb)
-- - created_at (timestamp)
-- - updated_at (timestamp)
-- - is_active (boolean)
-- - deactivated_at (timestamp)
-- - deactivated_by (varchar)
-- - deactivation_reason (text)
-- ============================================

-- Example execution for existing schemas:
-- ALTER TABLE company_a.employees DROP COLUMN IF EXISTS department, DROP COLUMN IF EXISTS policy_type, DROP COLUMN IF EXISTS coverage_limit, DROP COLUMN IF EXISTS annual_claim_limit, DROP COLUMN IF EXISTS outpatient_limit, DROP COLUMN IF EXISTS dental_limit, DROP COLUMN IF EXISTS optical_limit, DROP COLUMN IF EXISTS policy_start_date, DROP COLUMN IF EXISTS policy_end_date, DROP COLUMN IF EXISTS dependents;
-- ALTER TABLE company_b.employees DROP COLUMN IF EXISTS department, DROP COLUMN IF EXISTS policy_type, DROP COLUMN IF EXISTS coverage_limit, DROP COLUMN IF EXISTS annual_claim_limit, DROP COLUMN IF EXISTS outpatient_limit, DROP COLUMN IF EXISTS dental_limit, DROP COLUMN IF EXISTS optical_limit, DROP COLUMN IF EXISTS policy_start_date, DROP COLUMN IF EXISTS policy_end_date, DROP COLUMN IF EXISTS dependents;
-- ALTER TABLE cbre.employees DROP COLUMN IF EXISTS department, DROP COLUMN IF EXISTS policy_type, DROP COLUMN IF EXISTS coverage_limit, DROP COLUMN IF EXISTS annual_claim_limit, DROP COLUMN IF EXISTS outpatient_limit, DROP COLUMN IF EXISTS dental_limit, DROP COLUMN IF EXISTS optical_limit, DROP COLUMN IF EXISTS policy_start_date, DROP COLUMN IF EXISTS policy_end_date, DROP COLUMN IF EXISTS dependents;
