import { useState } from 'react';
import { useChatStore } from '../store/chatStore';

export default function LoginForm({ onLogin, onClose, primaryColor }) {
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { createSession } = useChatStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!employeeId.trim()) {
      setError('Please enter your employee ID');
      return;
    }

    setIsLoading(true);

    try {
      const sessionData = await createSession(employeeId.trim());
      onLogin(sessionData);
    } catch (err) {
      setError(err.message || 'Failed to start chat session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ic-bg-white ic-rounded-lg ic-shadow-xl ic-w-80 ic-overflow-hidden">
      {/* Header */}
      <div
        className="ic-p-4 ic-text-white ic-flex ic-items-center ic-justify-between"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="ic-flex ic-items-center ic-gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="ic-w-6 ic-h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
          <h3 className="ic-text-lg ic-font-semibold">Support</h3>
        </div>
        <button
          onClick={onClose}
          className="ic-text-white hover:ic-bg-white/20 ic-rounded ic-p-1 ic-transition-colors"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="ic-w-5 ic-h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Login Form */}
      <div className="ic-p-6">
        <p className="ic-text-gray-600 ic-mb-4 ic-text-sm">
          Welcome! Please enter your employee ID to start chatting with our AI support assistant.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="ic-mb-4">
            <label
              htmlFor="employeeId"
              className="ic-block ic-text-sm ic-font-medium ic-text-gray-700 ic-mb-2"
            >
              Employee ID
            </label>
            <input
              type="text"
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g., EMP001"
              className="ic-w-full ic-px-3 ic-py-2 ic-border ic-border-gray-300 ic-rounded-md focus:ic-outline-none focus:ic-ring-2 ic-text-gray-900"
              style={{ '--tw-ring-color': primaryColor }}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="ic-mb-4 ic-p-3 ic-bg-red-50 ic-border ic-border-red-200 ic-rounded-md">
              <p className="ic-text-sm ic-text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="ic-w-full ic-text-white ic-py-2 ic-px-4 ic-rounded-md ic-font-medium ic-transition-colors disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            {isLoading ? (
              <span className="ic-flex ic-items-center ic-justify-center ic-gap-2">
                <svg
                  className="ic-animate-spin ic-h-4 ic-w-4"
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
                Starting...
              </span>
            ) : (
              'Start Chat'
            )}
          </button>
        </form>

        <div className="ic-mt-4 ic-pt-4 ic-border-t ic-border-gray-200">
          <p className="ic-text-xs ic-text-gray-500 ic-text-center">
            Need help? Contact HR at hr@company.com
          </p>
        </div>
      </div>
    </div>
  );
}
