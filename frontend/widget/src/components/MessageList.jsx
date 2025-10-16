import Message from './Message';
import TypingIndicator from './TypingIndicator';

export default function MessageList({ messages, isLoading, messagesEndRef }) {
  return (
    <div className="ic-flex-1 ic-overflow-y-auto ic-p-4 ic-space-y-4 ic-bg-gray-50 ic-scrollbar">
      {messages.length === 0 && !isLoading && (
        <div className="ic-text-center ic-py-8">
          <div className="ic-w-16 ic-h-16 ic-bg-blue-100 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-mx-auto ic-mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="ic-w-8 ic-h-8 ic-text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h4 className="ic-text-gray-700 ic-font-medium ic-mb-2">
            Welcome to Insurance Support
          </h4>
          <p className="ic-text-sm ic-text-gray-500 ic-max-w-xs ic-mx-auto">
            Ask me anything about your insurance benefits, claims, coverage limits, or policies.
          </p>
        </div>
      )}

      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}

      {isLoading && <TypingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
}
