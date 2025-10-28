-- FAQ Knowledge Base Inserts for CBRE Client
-- NOTE: Run this script with your company schema name (e.g., company_a)
-- Replace {{SCHEMA_NAME}} with actual schema before running

-- Benefit Coverage Section (15 questions)

INSERT INTO {{SCHEMA_NAME}}.knowledge_base (title, content, category, subcategory, source, confidence_score, is_active, metadata)
VALUES
(
  'How do I check how much balance I have left? (RHB/LGI/Companies with benefit limit)',
  'Kindly drop us a message in the portal to check on your utilisation records.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 1}'::jsonb
),
(
  'Why is my claim up to $40/$60 only?',
  'You would be required to access your Benefits Portal and present the E-card upon registration otherwise the consultation reimbursement would fall under Non-panel GP benefit limit.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 2}'::jsonb
),
(
  'How do I claim GPA?',
  'Please find the Personal Accident form in the portal under Benefits > Documents, to submit for claims.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 3}'::jsonb
),
(
  'How long is my referral valid for?',
  'Referral letter to Panel or Non-Panel Specialist from Panel GP will be valid till discharge by Specialist. However, do note that an updated memo is required if the last visit is more than 1 year ago.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 4}'::jsonb
),
(
  'Do I need a referral letter for visit to Gynae?',
  'Referral letter is waived for visits to gynaecologist for conditions not normally treated by GP.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 5}'::jsonb
),
(
  'I have been to my specialist but I would like a second opinion.',
  'Please be advised that 2nd opinion is not covered.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 6}'::jsonb
),
(
  'I don''t have a referral letter, the polyclinic has given me a booking to the GRH for further treatment?',
  'You may contact the hospital/clinic to provide you with the copy of the referral letter.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 7}'::jsonb
),
(
  'What is the dateline of claims?',
  'Please be advised that claims are to be submitted within 30 days of incurred.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 8}'::jsonb
),
(
  'What is surgical schedule?',
  'A Surgical schedule is surgical percentage being applied to derive the payable surgeon fees for procedures done in a private hospital.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 9}'::jsonb
),
(
  'Can I claim for a scope?',
  'There must be signs & symptoms that necessitate the scope being performed. If not, the scope may not be covered. Kindly provide your referral or order form for us to assist you.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 10}'::jsonb
),
(
  'How much is my coverage if I need to do a cataract surgery?',
  'Kindly be advised that this would depend on if the surgery us done in a private or a government restructured hospital. Kindly provide us with the care cost form/financial cost form for us to advise you further.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 11}'::jsonb
),
(
  'Why do I need to authorise my Medisave when I''m admitted to the hospital?',
  'Yes.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 12}'::jsonb
),
(
  'For hospital & surgical claims, will the insurance company pay back to my Medisave account?',
  'If you had used the LOG at the hospital, the insurer would first pay to the hospital, then to you if you had made any cheque or cash payment, and finally to your Medisave account less any incurred expenses not covered. If you had settled the bill directly at the hospital and utilized your Medisave account, the insurer will first pay to you the cheque or cash payment and finally to your Medisave account less any incurred expenses not covered.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 13}'::jsonb
),
(
  'How does the co-payment work for hospital admission? Can I use my personal insurance?',
  'Yes, you may utilise your Medisave or Personal Insurance for the co-payment amount.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 14}'::jsonb
),
(
  'How much will be covered and what do I have to pay?',
  'We are unable to advise on the interim, kindly provide the referral letter and/or invoice for us to assist you further.',
  'benefits',
  'coverage',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Benefit Coverage", "question_number": 15}'::jsonb
);

-- Letter of Guarantee (LOG) Section (1 question)

INSERT INTO {{SCHEMA_NAME}}.knowledge_base (title, content, category, subcategory, source, confidence_score, is_active, metadata)
VALUES
(
  'How do I request for a Letter of Guarantee?',
  E'Please assist to advise us on the following at least 1 week before your procedure:\n\n-\tAdmission Date:\n-\tHospital Name (The surgery must be performing in the hospital operating theatre):\n-\tDiagnosis: \n\nDo provide us with the referral letter, pre admission letter, and/or financial cost form where applicable.',
  'log',
  'requests',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Letter of Guarantee (LOG)", "question_number": 1}'::jsonb
);

-- Portal Matters Section (8 questions)

INSERT INTO {{SCHEMA_NAME}}.knowledge_base (title, content, category, subcategory, source, confidence_score, is_active, metadata)
VALUES
(
  'How do I submit medical claims?',
  E'Kindly be advised that employee would have to submit the claims on your behalf through the portal at https://benefits.inspro.com.sg/. \n\nYou may submit your claim under New Claims > Select incurred date using the calendar icon > Claim Category: Insurance',
  'portal',
  'claims_submission',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Portal Matters", "question_number": 1}'::jsonb
),
(
  'I cannot log in, how do I reset my password?',
  'Kindly click on the "First Time Login/Forgot your password"',
  'portal',
  'access',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Portal Matters", "question_number": 3}'::jsonb
),
(
  'How Can I change my phone number For the OTP?',
  'Please be advised to email to us at helpdesk@inpro.com.sg with your new contact details for us to update.',
  'portal',
  'access',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Portal Matters", "question_number": 4}'::jsonb
),
(
  'I am unable to submit the claim, "consent statement" required? Where is the consent statement?',
  'Kindly use the calendar icon to select the date for more fields to appear. The consent statement is a toggle button just above the Submit button.',
  'portal',
  'claims_submission',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Portal Matters", "question_number": 5}'::jsonb
),
(
  'Where can I find my GP Panel List?',
  E'Please be advised that the GP Listing is updated monthly and it is not advisable to circulate the listing. \n\nEmployee has to access the portal and click on Ecard > Find your nearest clinic, to locate GP under the Panel.',
  'portal',
  'panel_lists',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Portal Matters", "question_number": 6}'::jsonb
),
(
  'Where can I find my Specialist Panel list?',
  'Please furnish your referral for us to assist you further. Please be informed that for a Specialist visit, you may contact the Tokyo Marine concierge at 3129 3002 to make an appointment for Panel Specialist.',
  'portal',
  'panel_lists',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Portal Matters", "question_number": 7}'::jsonb
),
(
  'Why do I have to make payment at Panel clinic?',
  E'Kindly advise if you have provided the eCard upon registration. Please be advised that Panel clinic may request payment for the following reasons:\n(a) Conditions not covered E.g. Prevention – if you are travelling and you ask for flu or diarrhoea medication\nalthough you are not suffering from these medical conditions\n(b) Medication not related to the medical condition you are seeking treatment for. E.g. You have flu, but you\nask for cream for your skin\n(c) Collection of medicine with no consultation E.g. Calling the doctor to ask for Panadol tablets\n(d) Obtaining Referral Letter / Medical Certificate (MC) only. Some doctors will charge even if there is no\nmedication given as the doctor''s time is taken to issue these documents',
  'portal',
  'panel_lists',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Portal Matters", "question_number": 8}'::jsonb
);

-- Claims Status Section (3 questions)

INSERT INTO {{SCHEMA_NAME}}.knowledge_base (title, content, category, subcategory, source, confidence_score, is_active, metadata)
VALUES
(
  'When will my claims be reimbursed?',
  'Please be informed that all claims processing time will take about 17 working days to a calendar month upon receiving full documentation. You will be notified on the outcome once the insurer has assessed the claim.',
  'claims',
  'status',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Claims Status", "question_number": 1}'::jsonb
),
(
  'The status is "paid", but I haven''t received it on my end.',
  'Please be advised that bank processing may take up to 7 working days.',
  'claims',
  'status',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Claims Status", "question_number": 2}'::jsonb
),
(
  'My flexible claims has been submitted for a long time, is there something wrong?',
  'Please be informed that for Flexible benefits claims, the claim processing time will take place after the last day of submission and claims will be approved into the following months'' payroll',
  'claims',
  'status',
  'Helpdesk FAQ - CBRE',
  1.0,
  true,
  '{"section": "Claims Status", "question_number": 3}'::jsonb
);

-- Summary
SELECT
  category,
  subcategory,
  COUNT(*) as total_entries
FROM {{SCHEMA_NAME}}.knowledge_base
WHERE source = 'Helpdesk FAQ - CBRE'
GROUP BY category, subcategory
ORDER BY category, subcategory;
