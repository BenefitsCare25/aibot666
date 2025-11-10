import { useState } from 'react';

const QUICK_QUESTIONS = [
  {
    id: 'benefit-coverage',
    title: 'Benefit Coverage',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    questions: [
      { q: 'How do I check how much balance I have left for Specialist?', a: 'Kindly drop us a message in the portal to check on your utilisation records.' },
      { q: 'Why is my claim up to $60 only?', a: 'Please be informed of the possible reasons below.\n\n(a) For Panel Clinics, you would be required to access your Benefits Portal and present the Ecard upon registration otherwise the consultation reimbursement would fall under Non-panel GP benefit limit, up to $60.\n(b) For Non Panel clinics, reimbursement is up to $60 only.' },
      { q: 'How do I claim GPA?', a: 'Please download the Group Personal Accident form in the portal under Benefits > Documents then complete the claim form (Page 1-3 only, ignore the medical report) and email back to us at helpdesk@inspro.com.sg.\n\nKindly note Policyholder is the company name and endorse the claim form with HR’s signature together with the company stamp.' },
      { q: 'How long is my referral valid for?', a: 'Referral letter to Panel or Non-Panel Specialist from Panel GP will be valid till discharge by Specialist. However, do note that an updated memo is required if the last visit is more than 1 year ago.' },
      { q: 'Do I need a referral letter for visit to Gynae?', a: 'Referral letter is waived for visits to gynaecologist for medical conditions not normally treated by GP.' },
      { q: 'I have been to my specialist but I would like a second opinion.', a: 'Please be advised that 2nd opinion is not covered under the policy.' },
      { q: 'I don’t have a referral letter, the polyclinic has given me a booking to the GRH for further treatment?', a: 'You may do as below.\n\n(a) Contact the specialist hospital/clinic to provide you with the copy of the referral letter. Please note that expenses and costs incurred for obtaining documents such as referral letters or memos would not be payable.\n(b) Request the referral letter from the specialist on your next visit to the specialist.' },
      { q: 'What is the dateline of claims?', a: 'Please be advised that claims are to be submitted within 30 days of incurred.' },
      { q: 'What is surgical schedule?', a: 'A Surgical schedule is surgical percentage being applied to derive the payable surgeon fees for procedures done in a private hospital.' },
      { q: 'Can I claim for a scope?', a: 'Please be informed that the scope procedure is covered under the policy and all claims will be subjected to insurer’s assessment however it will not be covered should the claim falls under the exclusion of the below. \n\n(a) Health screening / Investigative procedure\n(b) Pre-existing condition for new hirers below 12 months coverage' },
      { q: 'How much is my coverage if I need to do a cataract surgery?', a: 'Kindly be advised that this would depend on if the surgery us done in a private or a government restructured hospital. Kindly provide us with the financial counselling form/ care cost form for us to advise you further.' },
      { q: 'Why do I need to authorise my Medisave when I’m admitted to the hospital?', a: 'Please be informed that ustilising a  Letter of Gaurantee would require activation of Medisave as per the rules and regulations of Insurer and Hospital.' },
      { q: 'For hospital & surgical claims, will the insurance company pay back to my Medisave account?', a: 'If you had used the LOG at the hospital, the insurer would first pay to the hospital, then to you if you had made any cheque or cash payment, and finally to your Medisave account less any incurred expenses not covered. If you had settled the bill directly at the hospital and utilized your Medisave account, the insurer will first pay to you the cheque or cash payment and finally to your Medisave account less any incurred expenses not covered.' },
      { q: 'Can I use my personal insurance for hospital admission?', a: 'You may utilise your Medisave or Personal Insurance for hospital admission.' },
      { q: 'How much will be covered and what do I have to pay?', a: 'We are unable to advise on the interim, kindly provide the referral letter and/or invoice for us to assist you further.' },
      { q: 'Also to check understand our family like parent, children, husband or wife they can claim under my company insurance, May I know which of the category they able to claim?', a: 'Please find that the Group Insurance is extended to employee\'s only. \nKindly be advised that both employee and their direct family members can enjoy the Familycare services for preferred rates under Fullerton Health. You may wish to locate the information guide for Familycare program via the portal under Benefits > Documents.' },
      { q: 'I am looking into Health screening plans under Fullerton Health. May check if there is any special rate for CBRE employee?', a: 'Yes, there is a customised package A for CBRE employees. KIndly log in to our portal to download the deck under Benefit > Documents > CBRE Fullerton Health - Executive Customised Health Screening Package A.' },
      { q: 'I’m checking to see if the influenza vaccine is part of the insurance benefits.', a: 'Please be informed that preventive care, vaccination, immunization, general check-up, health screening or genetic screening is not covered under the policy.' }
    ]
  },
  {
    id: 'letter-of-guarantee',
    title: 'Letter of Guarantee (LOG)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    questions: [
      { q: 'How do I request for a Letter of Guarantee?', a: 'Please assist to provide us with the referral letter, pre admission letter and financial cost form (private hospital) / care cost form (restructured hospital) via this chat or drop us a message in the portal for us to assist you further.' }
    ]
  },
  {
    id: 'portal-matters',
    title: 'Portal Matters',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    questions: [
      { q: 'How do I submit medical claims?', a: 'Kindly submit the claims by logging in to the portal under New Claims > Select incurred date using the calendar icon > Claim Category: Insurance' },
      { q: 'I cannot log in, what is my User ID?', a: '' },
      { q: 'I cannot log in, how do I reset my password?', a: 'Kindly click on the “First Time Login/Forgot your password” to reset your password.' },
      { q: 'How Can I change my phone number For the OTP?', a: 'Please be advised to email to us at helpdesk@inpro.com.sg with your new contact details for us to update.' },
      { q: 'I am unable to submit the claim, “consent statement” required? Where is the consent statement?', a: 'Kindly use the calendar icon to select the date for more fields to appear. The consent statement is a toggle button just above the Submit button.' },
      { q: 'Where can I find my GP Panel List?', a: 'Click on "Find your nearest clinic" to locate GP clinic under the Panel.' },
      { q: 'Where can I find my Specialist Panel list?', a: 'Kindly contact the Tokyo Marine concierge at 3129 3002 to make an appointment for Panel Specialist.' },
      { q: 'Why do I have to make payment at Panel clinic?', a: 'Kindly advise if you have provided the eCard upon registration. Please be advised that Panel clinic may request payment for the following reasons:\n\n(a) Conditions not covered E.g. Prevention – if you are travelling and you ask for flu or diarrhoea medication although you are not suffering from these medical conditions\n(b) Medication not related to the medical condition you are seeking treatment for. E.g. You have flu, but you ask for cream for your skin\n(c) Collection of medicine with no consultation E.g. Calling the doctor to ask for Panadol tablets\n(d) Obtaining Referral Letter / Medical Certificate (MC) only. Some doctors will charge even if there is no medication given as the doctor’s time is taken to issue these documents' }
    ]
  }
];

export default function QuickQuestions({ onQuestionSelect, primaryColor }) {
  const [expandedCategory, setExpandedCategory] = useState(null);

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const handleQuestionClick = (questionData) => {
    // Pass both question and answer to parent
    onQuestionSelect(questionData);
  };

  return (
    <div className="ic-flex-1 ic-overflow-y-auto ic-p-4 ic-space-y-3 ic-bg-gray-50">
      <div className="ic-text-center ic-mb-4">
        <div className="ic-w-12 ic-h-12 ic-bg-blue-100 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-mx-auto ic-mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-6 ic-h-6 ic-text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h4 className="ic-text-gray-800 ic-font-semibold ic-mb-1">
          Quick Questions
        </h4>
        <p className="ic-text-sm ic-text-gray-500">
          Select a category to view common questions
        </p>
      </div>

      {QUICK_QUESTIONS.map((category) => (
        <div key={category.id} className="ic-bg-white ic-rounded-lg ic-shadow-sm ic-overflow-hidden ic-border ic-border-gray-200 ic-transition-all">
          {/* Category Header */}
          <button
            onClick={() => toggleCategory(category.id)}
            className="ic-w-full ic-flex ic-items-center ic-justify-between ic-p-3 ic-text-left hover:ic-bg-gray-50 ic-transition-colors"
          >
            <div className="ic-flex ic-items-center ic-gap-3">
              <div
                className="ic-w-9 ic-h-9 ic-rounded-lg ic-flex ic-items-center ic-justify-center ic-text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {category.icon}
              </div>
              <div>
                <h5 className="ic-text-sm ic-font-semibold ic-text-gray-800">
                  {category.title}
                </h5>
                <p className="ic-text-xs ic-text-gray-500">
                  {category.questions.length} question{category.questions.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`ic-w-5 ic-h-5 ic-text-gray-400 ic-transition-transform ${
                expandedCategory === category.id ? 'ic-rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Questions List */}
          {expandedCategory === category.id && (
            <div className="ic-border-t ic-border-gray-200 ic-bg-gray-50 ic-animate-fade-in">
              {category.questions.map((questionData, index) => (
                <button
                  key={index}
                  onClick={() => handleQuestionClick(questionData)}
                  className="ic-w-full ic-text-left ic-px-4 ic-py-3 ic-text-sm ic-text-gray-700 hover:ic-bg-white hover:ic-shadow-sm ic-transition-all ic-duration-200 ic-border-b ic-border-gray-100 last:ic-border-b-0 ic-flex ic-items-start ic-gap-2 ic-group"
                  style={{
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="ic-w-4 ic-h-4 ic-flex-shrink-0 ic-mt-0.5 group-hover:ic-scale-110 ic-transition-transform"
                    style={{ color: primaryColor }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="ic-flex-1">{questionData.q}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="ic-w-4 ic-h-4 ic-flex-shrink-0 ic-mt-0.5 ic-opacity-0 group-hover:ic-opacity-100 ic-transition-opacity"
                    style={{ color: primaryColor }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
