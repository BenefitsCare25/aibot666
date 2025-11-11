-- ============================================
-- Update Helpdesk Email in Knowledge Base
-- ============================================
-- This updates the FAQ answer to use the correct email address
-- Run this in Supabase SQL editor for CBRE schema

-- Update for CBRE schema
UPDATE cbre.knowledge_base
SET content = 'Please be advised to email to us at helpdesk@inspro.com.sg with your new contact details for us to update.'
WHERE title = 'How Can I change my phone number For the OTP?'
  AND content LIKE '%helpdesk@inpro.com.sg%';

-- Verify the update
SELECT id, title, content
FROM cbre.knowledge_base
WHERE title = 'How Can I change my phone number For the OTP?';

-- If you have other company schemas, update them too:
-- UPDATE company_a.knowledge_base
-- SET content = 'Please be advised to email to us at helpdesk@inspro.com.sg with your new contact details for us to update.'
-- WHERE title = 'How Can I change my phone number For the OTP?'
--   AND content LIKE '%helpdesk@inpro.com.sg%';

-- UPDATE company_b.knowledge_base
-- SET content = 'Please be advised to email to us at helpdesk@inspro.com.sg with your new contact details for us to update.'
-- WHERE title = 'How Can I change my phone number For the OTP?'
--   AND content LIKE '%helpdesk@inpro.com.sg%';
