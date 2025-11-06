import json

def escape_js_string(text):
    """Escape string for JavaScript"""
    if not text:
        return ''
    # Replace backslashes first
    text = text.replace('\\', '\\\\')
    # Replace single quotes
    text = text.replace("'", "\\'")
    # Replace newlines with actual \n
    text = text.replace('\n', '\\n')
    return text

def generate_quick_questions_jsx():
    """Generate QuickQuestions.jsx from FAQ JSON"""

    # Read FAQ data
    with open('C:/Users/huien/aibot/faq_sections.json', 'r', encoding='utf-8') as f:
        faq_data = json.load(f)

    # Icon SVG definitions for each category
    icons = {
        "Benefit Coverage": '''<svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>''',
        "Letter of Guarantee (LOG)": '''<svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>''',
        "Portal Matters": '''<svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>''',
        "Claims Status": '''<svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>'''
    }

    # Category ID mapping
    category_ids = {
        "Benefit Coverage": "benefit-coverage",
        "Letter of Guarantee (LOG)": "letter-of-guarantee",
        "Portal Matters": "portal-matters",
        "Claims Status": "claims-status"
    }

    # Start building the JSX content
    jsx_content = '''import { useState } from 'react';

const QUICK_QUESTIONS = [
'''

    # Generate each category
    for idx, (section_name, questions) in enumerate(faq_data.items()):
        category_id = category_ids.get(section_name, section_name.lower().replace(' ', '-'))
        icon_svg = icons.get(section_name, icons["Benefit Coverage"])

        # Add comma if not first item
        if idx > 0:
            jsx_content += ',\n'

        jsx_content += f'''  {{
    id: '{category_id}',
    title: '{section_name}',
    icon: (
      {icon_svg}
    ),
    questions: [
'''

        # Add questions for this category
        for q_idx, q in enumerate(questions):
            question_text = escape_js_string(q['question'])
            answer_text = escape_js_string(q['answer'])

            # Add comma if not first question
            if q_idx > 0:
                jsx_content += ',\n'

            jsx_content += f"      {{ q: '{question_text}', a: '{answer_text}' }}"

        jsx_content += '\n    ]\n  }'

    # Complete the file with the component code
    jsx_content += '''
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
'''

    # Write to file
    output_path = 'C:/Users/huien/aibot/frontend/widget/src/components/QuickQuestions.jsx'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(jsx_content)

    print(f"Successfully generated: {output_path}")

    # Summary
    total_questions = sum(len(questions) for questions in faq_data.values())
    print(f"\nGenerated {len(faq_data)} categories with {total_questions} total questions")
    for section_name, questions in faq_data.items():
        print(f"  - {section_name}: {len(questions)} questions")

if __name__ == "__main__":
    generate_quick_questions_jsx()
