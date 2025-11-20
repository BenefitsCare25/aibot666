import { useState } from 'react';
import { useChatStore } from '../store/chatStore';

export default function LoginForm({ onLogin, onClose, primaryColor }) {
  const [identifier, setIdentifier] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const { createSession, apiUrl, domain: companyDomain } = useChatStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!identifier.trim()) {
      setError('Please enter your employee ID, user ID, or email');
      return;
    }

    setIsLoading(true);

    try {
      const sessionData = await createSession(identifier.trim());
      onLogin(sessionData);
    } catch (err) {
      const errorMessage = err.message || 'Failed to start chat session';

      // Show callback form for employee validation errors (not found OR deactivated)
      // This includes: "Employee not found", "Failed to create session" (when employee is deactivated)
      const isEmployeeValidationError =
        errorMessage.includes('Employee not found') ||
        errorMessage.includes('employee not found') ||
        errorMessage.includes('Failed to create session');

      if (isEmployeeValidationError) {
        setError('Invalid credentials, please contact helpdesk at 64487707');
        setShowCallbackForm(true); // Show callback form for any employee validation failure
      } else {
        // Only server/network errors go here
        setError(errorMessage);
        setShowCallbackForm(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!contactNumber.trim()) {
      setError('Please enter your contact number');
      return;
    }

    // Basic phone number validation (at least 8 digits)
    const phoneRegex = /^\+?[\d\s\-()]{8,}$/;
    if (!phoneRegex.test(contactNumber.trim())) {
      setError('Please enter a valid contact number');
      return;
    }

    setIsLoading(true);

    try {
      // Use domain from store (passed via init config), fallback to current hostname
      const domain = companyDomain || window.location.hostname;

      const response = await fetch(`${apiUrl}/api/chat/callback-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Widget-Domain': domain
        },
        body: JSON.stringify({
          contactNumber: contactNumber.trim(),
          employeeId: identifier || null
        })
      });

      // Get response text first to handle potential parsing errors
      const responseText = await response.text();

      // Try to parse as JSON
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error(`Server returned invalid response: ${responseText || 'Empty response'}`);
      }

      // Check if response is OK
      if (!response.ok) {
        const errorMessage = data.error || `Server error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      setSuccessMessage('Our team will contact you within the next working day');
      setContactNumber(''); // Clear the input
    } catch (err) {
      console.error('Error submitting callback request:', err);
      setError(err.message || 'Failed to submit contact number. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ic-bg-white ic-rounded-2xl ic-shadow-2xl ic-w-[450px] ic-overflow-hidden ic-border ic-border-gray-100">
      {/* Header with Red Gradient */}
      <div
        className="ic-p-6 ic-text-white ic-relative"
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
          borderRadius: '1rem 1rem 0 0'
        }}
      >
        <div className="ic-flex ic-items-center ic-justify-between ic-mb-2">
          <div className="ic-flex ic-items-center ic-gap-3">
            <div className="ic-w-12 ic-h-12 ic-bg-white/20 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-backdrop-blur-sm ic-border-2 ic-border-white/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="ic-w-7 ic-h-7"
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
            <div>
              <h3 className="ic-text-xl ic-font-bold ic-tracking-tight">Chat with us</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 ic-transition-all ic-duration-200 hover:ic-scale-110"
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
      </div>

      {/* Login Form */}
      <div className="ic-p-6 ic-bg-gradient-to-b ic-from-gray-50 ic-to-white">
        <p className="ic-text-gray-700 ic-mb-6 ic-text-base ic-font-medium ic-text-center">
          Verify yourself to start chatting
        </p>

        <form onSubmit={handleSubmit} className="ic-space-y-4">
          <div>
            <label
              htmlFor="identifier"
              className="ic-block ic-text-sm ic-font-semibold ic-text-gray-700 ic-mb-2"
            >
              Employee ID / User ID / Email
            </label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g., EMP001 or user@example.com"
              className="ic-w-full ic-px-4 ic-py-3 ic-border ic-border-gray-300 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-500 focus:ic-border-transparent ic-text-gray-900 ic-shadow-sm ic-transition-all"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="ic-w-full ic-text-white ic-py-3 ic-px-4 ic-rounded-xl ic-font-semibold ic-transition-all disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-shadow-lg ic-transform hover:ic-scale-[1.02] ic-duration-200"
            style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)' }}
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

        {/* Show callback form only when employee ID validation fails */}
        {showCallbackForm && (
          <>
            {/* Divider */}
            <div className="ic-my-4 ic-flex ic-items-center">
              <div className="ic-flex-1 ic-border-t ic-border-gray-200"></div>
              <span className="ic-px-3 ic-text-xs ic-text-gray-500">OR</span>
              <div className="ic-flex-1 ic-border-t ic-border-gray-200"></div>
            </div>

            {/* Contact Number Form */}
            <form onSubmit={handleContactSubmit} className="ic-space-y-4">
          <div>
            <label
              htmlFor="contactNumber"
              className="ic-block ic-text-sm ic-font-semibold ic-text-gray-700 ic-mb-2"
            >
              Request Callback
            </label>
            <input
              type="tel"
              id="contactNumber"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g., +65 9123 4567"
              className="ic-w-full ic-px-4 ic-py-3 ic-border ic-border-gray-300 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-500 focus:ic-border-transparent ic-text-gray-900 ic-shadow-sm ic-transition-all"
              disabled={isLoading}
            />
            <p className="ic-text-xs ic-text-gray-500 ic-mt-2 ic-italic">
              We'll call you back during office hours
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="ic-w-full ic-text-white ic-py-3 ic-px-4 ic-rounded-xl ic-font-semibold ic-transition-all disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-shadow-lg ic-transform hover:ic-scale-[1.02] ic-duration-200"
            style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)' }}
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
                Submitting...
              </span>
            ) : (
              'Submit Contact Number'
            )}
          </button>
        </form>

            {/* Success Message (inside callback form) */}
            {successMessage && (
              <div className="ic-mt-4 ic-p-4 ic-bg-green-50 ic-border-l-4 ic-border-green-500 ic-rounded-lg ic-shadow-sm">
                <p className="ic-text-sm ic-text-green-700 ic-font-medium">{successMessage}</p>
              </div>
            )}
          </>
        )}

        {/* Error Message (outside callback form, always visible) */}
        {error && (
          <div className="ic-mt-4 ic-p-4 ic-bg-red-50 ic-border-l-4 ic-border-red-500 ic-rounded-lg ic-shadow-sm">
            <p className="ic-text-sm ic-text-red-700 ic-font-medium">{error}</p>
          </div>
        )}

        <div className="ic-mt-6 ic-pt-4 ic-border-t ic-border-gray-200">
          <p className="ic-text-xs ic-text-gray-500 ic-text-center ic-flex ic-items-center ic-justify-center ic-gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-4 ic-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            helpdesk@inspro.com.sg
          </p>
        </div>
      </div>
    </div>
  );
}
