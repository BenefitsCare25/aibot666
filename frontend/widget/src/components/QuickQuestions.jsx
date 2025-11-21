import { useState, useEffect } from 'react';
import { Shield, FileText, Monitor, ClipboardCheck, HelpCircle, Info } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

// Icon mapping - Lucide icons for modern clean design
const ICON_MAP = {
  shield: <Shield className="ic-w-5 ic-h-5" strokeWidth={2} />,
  document: <FileText className="ic-w-5 ic-h-5" strokeWidth={2} />,
  computer: <Monitor className="ic-w-5 ic-h-5" strokeWidth={2} />,
  clipboard: <ClipboardCheck className="ic-w-5 ic-h-5" strokeWidth={2} />,
  question: <HelpCircle className="ic-w-5 ic-h-5" strokeWidth={2} />,
  info: <Info className="ic-w-5 ic-h-5" strokeWidth={2} />
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
      <div
        className="ic-flex-1 ic-overflow-y-auto ic-p-4"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        <div className="ic-text-center ic-py-8" style={{ color: 'var(--color-text-secondary)' }}>
          Loading questions...
        </div>
      </div>
    );
  }

  if (quickQuestions.length === 0) {
    return (
      <div
        className="ic-flex-1 ic-overflow-y-auto ic-p-4"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        <div className="ic-text-center ic-py-8" style={{ color: 'var(--color-text-secondary)' }}>
          No quick questions available
        </div>
      </div>
    );
  }

  return (
    <div
      className="ic-flex-1 ic-overflow-y-auto ic-p-5 ic-space-y-3 ic-min-h-0"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* Header */}
      <div className="ic-text-center ic-mb-5">
        <div
          className="ic-w-12 ic-h-12 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-mx-auto ic-mb-3"
          style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
        >
          <HelpCircle
            className="ic-w-6 ic-h-6"
            style={{ color: 'var(--color-primary-600)' }}
            strokeWidth={2}
          />
        </div>
        <h4
          className="ic-font-bold ic-mb-1 ic-text-base"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Quick Questions
        </h4>
        <p className="ic-text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Select a category to view common questions
        </p>
      </div>

      {/* Categories */}
      {quickQuestions.map((category) => (
        <div
          key={category.id}
          className="ic-rounded-xl ic-overflow-hidden ic-border ic-transition-all ic-shadow-soft"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border)'
          }}
        >
          {/* Category Header */}
          <button
            onClick={() => toggleCategory(category.id)}
            className="ic-w-full ic-flex ic-items-center ic-justify-between ic-p-4 ic-text-left ic-transition-colors"
            style={{
              backgroundColor: expandedCategory === category.id ? 'var(--color-bg-secondary)' : 'transparent'
            }}
          >
            <div className="ic-flex ic-items-center ic-gap-3">
              <div
                className="ic-w-10 ic-h-10 ic-rounded-lg ic-flex ic-items-center ic-justify-center ic-text-white"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {category.icon}
              </div>
              <div>
                <h5
                  className="ic-text-sm ic-font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {category.title}
                </h5>
                <p className="ic-text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {category.questions.length} question{category.questions.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`ic-w-5 ic-h-5 ic-transition-transform ${
                expandedCategory === category.id ? 'ic-rotate-180' : ''
              }`}
              style={{ color: 'var(--color-text-tertiary)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Questions List */}
          {expandedCategory === category.id && (
            <div
              className="ic-border-t ic-animate-fade-in ic-p-3 ic-space-y-2"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
            >
              {category.questions.map((questionData, index) => (
                <button
                  key={questionData.id || index}
                  onClick={() => handleQuestionClick(questionData, category.title)}
                  className="ic-w-full ic-text-left ic-px-4 ic-py-3 ic-text-sm ic-text-white ic-font-medium ic-rounded-xl hover:ic-shadow-soft-md ic-transition-all ic-duration-200 ic-transform hover:ic-scale-[1.01]"
                  style={{
                    background: 'var(--gradient-primary)',
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  {questionData.q}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
