-- ============================================
-- Add quick_questions table to existing company schemas
-- ============================================
-- Run this script in Supabase SQL Editor to add the quick_questions table
-- to all existing company schemas (cbre, company_c, company_a, company_b)

-- CBRE Schema
CREATE TABLE IF NOT EXISTS cbre.quick_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR(100) NOT NULL,
  category_title VARCHAR(255) NOT NULL,
  category_icon VARCHAR(50) DEFAULT 'question',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbre_qq_category ON cbre.quick_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_cbre_qq_active ON cbre.quick_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_cbre_qq_order ON cbre.quick_questions(category_id, display_order);

-- Company C Schema
CREATE TABLE IF NOT EXISTS company_c.quick_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR(100) NOT NULL,
  category_title VARCHAR(255) NOT NULL,
  category_icon VARCHAR(50) DEFAULT 'question',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_c_qq_category ON company_c.quick_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_company_c_qq_active ON company_c.quick_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_company_c_qq_order ON company_c.quick_questions(category_id, display_order);

-- Company A Schema
CREATE TABLE IF NOT EXISTS company_a.quick_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR(100) NOT NULL,
  category_title VARCHAR(255) NOT NULL,
  category_icon VARCHAR(50) DEFAULT 'question',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_a_qq_category ON company_a.quick_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_company_a_qq_active ON company_a.quick_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_company_a_qq_order ON company_a.quick_questions(category_id, display_order);

-- Company B Schema
CREATE TABLE IF NOT EXISTS company_b.quick_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR(100) NOT NULL,
  category_title VARCHAR(255) NOT NULL,
  category_icon VARCHAR(50) DEFAULT 'question',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_b_qq_category ON company_b.quick_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_company_b_qq_active ON company_b.quick_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_company_b_qq_order ON company_b.quick_questions(category_id, display_order);

-- ============================================
-- OPTIONAL: Insert sample data for CBRE (based on existing hardcoded questions)
-- ============================================
-- Uncomment the sections below if you want to populate CBRE with the existing questions

/*
-- Benefit Coverage Questions
INSERT INTO cbre.quick_questions (category_id, category_title, category_icon, question, answer, display_order) VALUES
('benefit-coverage', 'Benefit Coverage', 'shield', 'How do I check how much balance I have left for Specialist?', 'Kindly drop us a message in the portal to check on your utilisation records.', 0),
('benefit-coverage', 'Benefit Coverage', 'shield', 'Why is my claim up to $60 only?', 'Please be informed of the possible reasons below.

(a) For Panel Clinics, you would be required to access your Benefits Portal and present the Ecard upon registration otherwise the consultation reimbursement would fall under Non-panel GP benefit limit, up to $60.
(b) For Non Panel clinics, reimbursement is up to $60 only.', 1),
('benefit-coverage', 'Benefit Coverage', 'shield', 'How do I claim GPA?', 'Please download the Group Personal Accident form in the portal under Benefits > Documents then complete the claim form (Page 1-3 only, ignore the medical report) and email back to us at helpdesk@inspro.com.sg.

Kindly note Policyholder is the company name and endorse the claim form with HR''s signature together with the company stamp.', 2),
('benefit-coverage', 'Benefit Coverage', 'shield', 'How long is my referral valid for?', 'Referral letter to Panel or Non-Panel Specialist from Panel GP will be valid till discharge by Specialist. However, do note that an updated memo is required if the last visit is more than 1 year ago.', 3),
('benefit-coverage', 'Benefit Coverage', 'shield', 'Do I need a referral letter for visit to Gynae?', 'Referral letter is waived for visits to gynaecologist for medical conditions not normally treated by GP.', 4);

-- Letter of Guarantee Questions
INSERT INTO cbre.quick_questions (category_id, category_title, category_icon, question, answer, display_order) VALUES
('letter-of-guarantee', 'Letter of Guarantee (LOG)', 'document', 'How do I request for a Letter of Guarantee?', 'Please assist to provide us with the referral letter, pre admission letter and financial cost form (private hospital) / care cost form (restructured hospital) via this chat or drop us a message in the portal for us to assist you further.', 0);

-- Portal Matters Questions
INSERT INTO cbre.quick_questions (category_id, category_title, category_icon, question, answer, display_order) VALUES
('portal-matters', 'Portal Matters', 'computer', 'How do I submit medical claims?', 'Kindly submit the claims by logging in to the portal under New Claims > Select incurred date using the calendar icon > Claim Category: Insurance', 0),
('portal-matters', 'Portal Matters', 'computer', 'I cannot log in, how do I reset my password?', 'Kindly click on the "First Time Login/Forgot your password" to reset your password.', 1),
('portal-matters', 'Portal Matters', 'computer', 'Where can I find my GP Panel List?', 'Click on "Find your nearest clinic" to locate GP clinic under the Panel.', 2),
('portal-matters', 'Portal Matters', 'computer', 'Where can I find my Specialist Panel list?', 'Kindly contact the Tokyo Marine concierge at 3129 3002 to make an appointment for Panel Specialist.', 3);
*/

-- ============================================
-- Verification: Check if tables were created successfully
-- ============================================
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename = 'quick_questions'
  AND schemaname IN ('cbre', 'company_c', 'company_a', 'company_b')
ORDER BY schemaname;

-- ============================================
-- COMPLETE! Next steps:
-- ============================================
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Verify the tables were created (check the SELECT query results at the bottom)
-- 3. Go to Admin Panel > Quick Questions to add questions for each company
-- 4. New companies created in the future will automatically get this table
