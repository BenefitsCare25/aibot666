import { format } from 'date-fns';
import { useState } from 'react';

export default function ChatMessage({ message }) {
  const [showDetails, setShowDetails] = useState(false);
  const isUser = message.role === 'user';

  // Get confidence color
  const getConfidenceColor = (score) => {
    if (!score) return 'gray';
    if (score >= 0.8) return 'green';
    if (score >= 0.5) return 'yellow';
    return 'red';
  };

  const confidenceColor = getConfidenceColor(message.confidence_score);
  const confidenceColorClasses = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}>
      <div className={`max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Message bubble */}
        <div
          className={`rounded-lg px-4 py-3 shadow-sm ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-none'
              : 'bg-gray-100 text-gray-900 rounded-bl-none'
          }`}
        >
          {/* Bot icon for assistant messages */}
          {!isUser && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🤖</span>
              <span className="text-xs font-semibold text-gray-600">AI Assistant</span>
            </div>
          )}

          {/* Message content */}
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

          {/* Timestamp and badges */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
              {format(new Date(message.created_at), 'MMM d, h:mm a')}
            </span>

            {/* Confidence score for AI messages */}
            {!isUser && message.confidence_score && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${confidenceColorClasses[confidenceColor]}`}
              >
                {(message.confidence_score * 100).toFixed(0)}% confidence
              </span>
            )}

            {/* Escalation badge */}
            {message.was_escalated && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                ⚠️ Escalated
              </span>
            )}
          </div>

          {/* Sources (for AI messages) */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {showDetails ? '▼ Hide sources' : '▶ Show sources'} ({message.sources.length})
              </button>

              {showDetails && (
                <div className="mt-2 space-y-1">
                  {message.sources.map((source, idx) => (
                    <div
                      key={idx}
                      className="text-xs bg-white border border-gray-200 rounded p-2"
                    >
                      <div className="font-medium text-gray-700">{source.title || 'Source'}</div>
                      {source.category && (
                        <div className="text-gray-500 mt-0.5">{source.category}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
