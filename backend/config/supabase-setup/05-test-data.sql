-- ============================================
-- STEP 5: Insert Test Data for Both Companies
-- ============================================
-- This creates sample employees and knowledge base entries for testing

-- ============================================
-- COMPANY A TEST DATA
-- ============================================

-- Company A: Test Employees
INSERT INTO company_a.employees (employee_id, name, email, department, policy_type, coverage_limit, annual_claim_limit, outpatient_limit, dental_limit, optical_limit, policy_start_date, policy_end_date)
VALUES
  ('EMP001', 'Alice Anderson', 'alice@company-a.local', 'Engineering', 'Premium', 150000.00, 100000.00, 5000.00, 2000.00, 1000.00, '2024-01-01', '2024-12-31'),
  ('EMP002', 'Bob Brown', 'bob@company-a.local', 'Sales', 'Standard', 100000.00, 75000.00, 3000.00, 1500.00, 500.00, '2024-01-01', '2024-12-31'),
  ('EMP003', 'Carol Chen', 'carol@company-a.local', 'HR', 'Premium', 150000.00, 100000.00, 5000.00, 2000.00, 1000.00, '2024-01-01', '2024-12-31')
ON CONFLICT (employee_id) DO NOTHING;

-- Company A: Knowledge Base Entries
INSERT INTO company_a.knowledge_base (title, content, category, subcategory, is_active)
VALUES
  (
    'Company A Health Insurance Policy',
    'Company A provides comprehensive health insurance coverage for all full-time employees. Our Premium plan includes coverage up to $150,000 annually with generous outpatient, dental, and optical benefits. The Standard plan provides coverage up to $100,000 annually with moderate benefits.',
    'policy',
    'health_insurance',
    true
  ),
  (
    'How to Submit a Claim - Company A',
    'To submit a claim at Company A: 1) Keep all original receipts and medical reports. 2) Fill out the claim form available on the employee portal. 3) Submit within 30 days of treatment. 4) Claims are processed within 7-10 business days. For urgent claims, contact HR at hr@company-a.local.',
    'claims',
    'submission',
    true
  ),
  (
    'Dental Benefits - Company A',
    'Company A dental coverage includes: Annual checkups and cleaning (100% covered), Fillings and extractions (80% covered), Root canal and crowns (50% covered). Premium plan members have a $2,000 annual limit, Standard plan members have a $1,500 limit.',
    'benefits',
    'dental',
    true
  ),
  (
    'Optical Benefits - Company A',
    'Company A optical benefits cover: Eye exams (once per year, 100% covered), Prescription glasses or contact lenses (80% covered up to limit). Premium members: $1,000 annual limit. Standard members: $500 annual limit.',
    'benefits',
    'optical',
    true
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- COMPANY B TEST DATA
-- ============================================

-- Company B: Test Employees
INSERT INTO company_b.employees (employee_id, name, email, department, policy_type, coverage_limit, annual_claim_limit, outpatient_limit, dental_limit, optical_limit, policy_start_date, policy_end_date)
VALUES
  ('EMP001', 'David Davis', 'david@company-b.local', 'Finance', 'Basic', 80000.00, 60000.00, 2000.00, 1000.00, 300.00, '2024-01-01', '2024-12-31'),
  ('EMP002', 'Emma Evans', 'emma@company-b.local', 'Marketing', 'Enhanced', 120000.00, 90000.00, 4000.00, 1800.00, 800.00, '2024-01-01', '2024-12-31'),
  ('EMP003', 'Frank Foster', 'frank@company-b.local', 'Operations', 'Basic', 80000.00, 60000.00, 2000.00, 1000.00, 300.00, '2024-01-01', '2024-12-31')
ON CONFLICT (employee_id) DO NOTHING;

-- Company B: Knowledge Base Entries
INSERT INTO company_b.knowledge_base (title, content, category, subcategory, is_active)
VALUES
  (
    'Company B Insurance Overview',
    'Company B offers two insurance tiers: Basic and Enhanced. The Basic plan provides coverage up to $80,000 annually with standard benefits. The Enhanced plan covers up to $120,000 annually with upgraded benefits including higher outpatient, dental, and optical limits.',
    'policy',
    'health_insurance',
    true
  ),
  (
    'Claim Submission Process - Company B',
    'Company B claim process: 1) Collect all receipts and medical documentation. 2) Complete the online claim form at portal.company-b.local. 3) Submit within 60 days of treatment. 4) Standard processing time is 5-7 business days. For questions, email benefits@company-b.local.',
    'claims',
    'submission',
    true
  ),
  (
    'Dental Coverage - Company B',
    'Company B dental benefits: Preventive care (cleaning, checkups) - 100% covered. Basic procedures (fillings) - 70% covered. Major procedures (crowns, bridges) - 40% covered. Enhanced plan: $1,800 annual limit. Basic plan: $1,000 annual limit.',
    'benefits',
    'dental',
    true
  ),
  (
    'Vision Care - Company B',
    'Company B vision benefits include: Annual eye exams (fully covered), Prescription eyewear (frames and lenses) - 70% covered up to limit. Enhanced plan members: $800 annual limit. Basic plan members: $300 annual limit. Contact lenses covered in lieu of glasses.',
    'benefits',
    'optical',
    true
  ),
  (
    'Maternity Benefits - Company B',
    'Company B maternity coverage: Prenatal care and delivery covered up to policy limits. Enhanced plan covers 90% of maternity costs. Basic plan covers 80%. Coverage includes pre and postnatal checkups, delivery, and 1 month postnatal care.',
    'benefits',
    'maternity',
    true
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check Company A data
SELECT
  'Company A' as company,
  'Employees' as type,
  COUNT(*) as count
FROM company_a.employees
UNION ALL
SELECT
  'Company A' as company,
  'Knowledge Base' as type,
  COUNT(*) as count
FROM company_a.knowledge_base
UNION ALL
SELECT
  'Company B' as company,
  'Employees' as type,
  COUNT(*) as count
FROM company_b.employees
UNION ALL
SELECT
  'Company B' as company,
  'Knowledge Base' as type,
  COUNT(*) as count
FROM company_b.knowledge_base
ORDER BY company, type;

-- Should show:
-- Company A | Employees | 3
-- Company A | Knowledge Base | 4
-- Company B | Employees | 3
-- Company B | Knowledge Base | 5

-- Verify data isolation (test employees only see their own company)
SELECT name, email, policy_type FROM company_a.employees;
-- Should only show Alice, Bob, Carol

SELECT name, email, policy_type FROM company_b.employees;
-- Should only show David, Emma, Frank
