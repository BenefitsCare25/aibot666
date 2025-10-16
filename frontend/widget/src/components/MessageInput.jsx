export default function MessageInput({ value, onChange, onSend, onKeyPress, disabled, primaryColor }) {
  return (
    <div className="ic-p-4 ic-bg-white ic-border-t ic-border-gray-200">
      <div className="ic-flex ic-gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder="Type your question..."
          disabled={disabled}
          className="ic-flex-1 ic-px-3 ic-py-2 ic-border ic-border-gray-300 ic-rounded-md ic-resize-none ic-text-sm focus:ic-outline-none focus:ic-ring-2 ic-text-gray-900"
          style={{ '--tw-ring-color': primaryColor }}
          rows={1}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
          }}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="ic-px-4 ic-py-2 ic-text-white ic-rounded-md ic-transition-colors disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-opacity-90 ic-flex-shrink-0"
          style={{ backgroundColor: primaryColor }}
          aria-label="Send message"
        >
          {disabled ? (
            <svg
              className="ic-animate-spin ic-h-5 ic-w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="ic-opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="ic-opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="ic-h-5 ic-w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>
      <p className="ic-text-xs ic-text-gray-500 ic-mt-2">
        Press Enter to send • Shift + Enter for new line
      </p>
    </div>
  );
}
