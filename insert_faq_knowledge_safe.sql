-- FAQ Knowledge Base Insert Statements
-- Generated from Helpdesk FAQ for Chatbot.xlsx
-- Total Questions: 27

-- Clear existing FAQ data (optional - remove if you want to keep existing data)

-- Benefit Coverage (18 questions)

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'How do I check how much balance I have left for Specialist?',
  'Kindly drop us a message in the portal to check on your utilisation records.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 1, "has_detailed_answer": false}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'Why is my claim up to $60 only?',
  'Please be informed of the possible reasons below.

(a) For Panel Clinics, you would be required to access your Benefits Portal and present the Ecard upon registration otherwise the consultation reimbursement would fall under Non-panel GP benefit limit, up to $60.
(b) For Non Panel clinics, reimbursement is up to $60 only.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 2, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'How do I claim GPA?',
  'Please download the Group Personal Accident form in the portal under Benefits > Documents then complete the claim form (Page 1-3 only, ignore the medical report) and email back to us at helpdesk@inspro.com.sg.

Kindly note Policyholder is the company name and endorse the claim form with HR’s signature together with the company stamp.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 3, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'How long is my referral valid for?',
  'Referral letter to Panel or Non-Panel Specialist from Panel GP will be valid till discharge by Specialist. However, do note that an updated memo is required if the last visit is more than 1 year ago.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 4, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'Do I need a referral letter for visit to Gynae?',
  'Referral letter is waived for visits to gynaecologist for medical conditions not normally treated by GP.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 5, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'I have been to my specialist but I would like a second opinion.',
  'Please be advised that 2nd opinion is not covered under the policy.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 6, "has_detailed_answer": false}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'I don’t have a referral letter, the polyclinic has given me a booking to the GRH for further treatment?',
  'You may do as below.

(a) Contact the specialist hospital/clinic to provide you with the copy of the referral letter. Please note that expenses and costs incurred for obtaining documents such as referral letters or memos would not be payable.
(b) Request the referral letter from the specialist on your next visit to the specialist.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 7, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'What is the dateline of claims?',
  'Please be advised that claims are to be submitted within 30 days of incurred.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 8, "has_detailed_answer": false}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'What is surgical schedule?',
  'A Surgical schedule is surgical percentage being applied to derive the payable surgeon fees for procedures done in a private hospital.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 9, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'Can I claim for a scope?',
  'Please be informed that the scope procedure is covered under the policy and all claims will be subjected to insurer’s assessment however it will not be covered should the claim falls under the exclusion of the below. 

(a) Health screening / Investigative procedure
(b) Pre-existing condition for new hirers below 12 months coverage',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 10, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'How much is my coverage if I need to do a cataract surgery?',
  'Kindly be advised that this would depend on if the surgery us done in a private or a government restructured hospital. Kindly provide us with the financial counselling form/ care cost form for us to advise you further.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 11, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'Why do I need to authorise my Medisave when I’m admitted to the hospital?',
  'Please be informed that ustilising a  Letter of Gaurantee would require activation of Medisave as per the rules and regulations of Insurer and Hospital.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 12, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'For hospital & surgical claims, will the insurance company pay back to my Medisave account?',
  'If you had used the LOG at the hospital, the insurer would first pay to the hospital, then to you if you had made any cheque or cash payment, and finally to your Medisave account less any incurred expenses not covered. If you had settled the bill directly at the hospital and utilized your Medisave account, the insurer will first pay to you the cheque or cash payment and finally to your Medisave account less any incurred expenses not covered.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 13, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'Can I use my personal insurance for hospital admission?',
  'You may utilise your Medisave or Personal Insurance for hospital admission.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 14, "has_detailed_answer": false}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'How much will be covered and what do I have to pay?',
  'We are unable to advise on the interim, kindly provide the referral letter and/or invoice for us to assist you further.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 15, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'Also to check understand our family like parent, children, husband or wife they can claim under my company insurance, May I know which of the category they able to claim?',
  'Please find that the Group Insurance is extended to employee''s only. 
Kindly be advised that both employee and their direct family members can enjoy the Familycare services for preferred rates under Fullerton Health. You may wish to locate the information guide for Familycare program via the portal under Benefits > Documents.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 16, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'I am looking into Health screening plans under Fullerton Health. May check if there is any special rate for CBRE employee?',
  'Yes, there is a customised package A for CBRE employees. KIndly log in to our portal to download the deck under Benefit > Documents > CBRE Fullerton Health - Executive Customised Health Screening Package A.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 17, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'I’m checking to see if the influenza vaccine is part of the insurance benefits.',
  'Please be informed that preventive care, vaccination, immunization, general check-up, health screening or genetic screening is not covered under the policy.',
  'benefits',
  'coverage',
  '{"section": "Benefit Coverage", "question_number": 18, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

-- Letter of Guarantee (LOG) (1 questions)

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'How do I request for a Letter of Guarantee?',
  'Please assist to provide us with the referral letter, pre admission letter and financial cost form (private hospital) / care cost form (restructured hospital) via this chat or drop us a message in the portal for us to assist you further.',
  'log',
  'requests',
  '{"section": "Letter of Guarantee (LOG)", "question_number": 1, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

-- Portal Matters (8 questions)

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'How do I submit medical claims?',
  'Kindly submit the claims by logging in to the portal under New Claims > Select incurred date using the calendar icon > Claim Category: Insurance',
  'portal',
  'access',
  '{"section": "Portal Matters", "question_number": 1, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

-- Skipping Q2: No answer provided
INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'I cannot log in, how do I reset my password?',
  'Kindly click on the “First Time Login/Forgot your password” to reset your password.',
  'portal',
  'access',
  '{"section": "Portal Matters", "question_number": 3, "has_detailed_answer": false}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'How Can I change my phone number For the OTP?',
  'Please be advised to email to us at helpdesk@inpro.com.sg with your new contact details for us to update.',
  'portal',
  'access',
  '{"section": "Portal Matters", "question_number": 4, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'I am unable to submit the claim, “consent statement” required? Where is the consent statement?',
  'Kindly use the calendar icon to select the date for more fields to appear. The consent statement is a toggle button just above the Submit button.',
  'portal',
  'access',
  '{"section": "Portal Matters", "question_number": 5, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'Where can I find my GP Panel List?',
  'Click on "Find your nearest clinic" to locate GP clinic under the Panel.',
  'portal',
  'access',
  '{"section": "Portal Matters", "question_number": 6, "has_detailed_answer": false}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'Where can I find my Specialist Panel list?',
  'Kindly contact the Tokyo Marine concierge at 3129 3002 to make an appointment for Panel Specialist.',
  'portal',
  'access',
  '{"section": "Portal Matters", "question_number": 7, "has_detailed_answer": false}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);

INSERT INTO knowledge_base (title, content, category, subcategory, metadata, source, confidence_score, is_active)
VALUES (
  'Why do I have to make payment at Panel clinic?',
  'Kindly advise if you have provided the eCard upon registration. Please be advised that Panel clinic may request payment for the following reasons:

(a) Conditions not covered E.g. Prevention – if you are travelling and you ask for flu or diarrhoea medication although you are not suffering from these medical conditions
(b) Medication not related to the medical condition you are seeking treatment for. E.g. You have flu, but you ask for cream for your skin
(c) Collection of medicine with no consultation E.g. Calling the doctor to ask for Panadol tablets
(d) Obtaining Referral Letter / Medical Certificate (MC) only. Some doctors will charge even if there is no medication given as the doctor’s time is taken to issue these documents',
  'portal',
  'access',
  '{"section": "Portal Matters", "question_number": 8, "has_detailed_answer": true}'::jsonb,
  'Helpdesk FAQ Excel',
  1.0,
  true
);
