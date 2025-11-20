import { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';

// Icon mapping - renders SVG based on icon name
const ICON_MAP = {
  shield: (
    <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  document: (
    <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  computer: (
    <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  clipboard: (
    <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  question: (
    <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-5 ic-h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

export default function QuickQuestions({ onQuestionSelect, primaryColor }) {
  const [quickQuestions, setQuickQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const apiUrl = useChatStore((state) => state.apiUrl);
  const domain = useChatStore((state) => state.domain);

  useEffect(() => {
    // Load quick questions from API
    const loadQuickQuestions = async () => {
      try {
        // Use domain override if provided, otherwise extract from current page URL
        const currentDomain = domain || window.location.hostname;

        const response = await fetch(`${apiUrl}/api/chat/quick-questions`, {
          headers: {
            'X-Widget-Domain': currentDomain
          }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Transform data to match expected format
            const transformedData = result.data.map(category => ({
              id: category.id,
              title: category.title,
              icon: ICON_MAP[category.icon] || ICON_MAP.question,
              questions: category.questions
            }));
            setQuickQuestions(transformedData);
          }
        }
      } catch (error) {
        console.error('Failed to load quick questions:', error);
      } finally {
        setLoading(false);
      }
    };

    if (apiUrl) {
      loadQuickQuestions();
    }
  }, [apiUrl, domain]);

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const handleQuestionClick = (questionData, categoryTitle) => {
    // Pass both question data and category title for LOG detection
    onQuestionSelect(questionData, categoryTitle);
  };

  if (loading) {
    return (
      <div className="ic-flex-1 ic-overflow-y-auto ic-p-4" style={{ background: 'linear-gradient(180deg, #fce7f3 0%, #fecaca 100%)' }}>
        <div className="ic-text-center ic-py-8 ic-text-gray-700 ic-font-medium">
          Loading questions...
        </div>
      </div>
    );
  }

  if (quickQuestions.length === 0) {
    return (
      <div className="ic-flex-1 ic-overflow-y-auto ic-p-4" style={{ background: 'linear-gradient(180deg, #fce7f3 0%, #fecaca 100%)' }}>
        <div className="ic-text-center ic-py-8 ic-text-gray-700 ic-font-medium">
          No quick questions available
        </div>
      </div>
    );
  }

  return (
    <div className="ic-flex-1 ic-overflow-y-auto ic-p-4 ic-space-y-3" style={{ background: 'linear-gradient(180deg, #fce7f3 0%, #fecaca 100%)' }}>
      <div className="ic-text-center ic-mb-4">
        <div className="ic-w-14 ic-h-14 ic-bg-white/90 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-mx-auto ic-mb-3 ic-backdrop-blur-sm ic-shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-7 ic-h-7 ic-text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h4 className="ic-text-gray-800 ic-font-bold ic-mb-1 ic-text-lg">
          Quick Questions
        </h4>
        <p className="ic-text-sm ic-text-gray-600">
          Select a category to view common questions
        </p>
      </div>

      {quickQuestions.map((category) => (
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
            <div className="ic-border-t ic-border-gray-200 ic-bg-pink-50/50 ic-animate-fade-in ic-p-3 ic-space-y-2">
              {category.questions.map((questionData, index) => (
                <button
                  key={questionData.id || index}
                  onClick={() => handleQuestionClick(questionData, category.title)}
                  className="ic-w-full ic-text-left ic-px-4 ic-py-3 ic-text-sm ic-text-white ic-font-medium ic-rounded-full hover:ic-shadow-lg ic-transition-all ic-duration-200 ic-transform hover:ic-scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #ef4444 50%, #f87171 100%)',
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  <span className="ic-flex-1">{questionData.q}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
