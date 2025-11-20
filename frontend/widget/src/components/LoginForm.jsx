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
          <h3 className="ic-text-lg ic-font-semibold">Support (Beta)</h3>
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
          Welcome! Let us know if you have any enquires!
        </p>

        <form onSubmit={handleSubmit}>
          <div className="ic-mb-4">
            <label
              htmlFor="identifier"
              className="ic-block ic-text-sm ic-font-medium ic-text-gray-700 ic-mb-2"
            >
              Employee ID / User ID / Email
            </label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g., EMP001 or user@example.com"
              className="ic-w-full ic-px-3 ic-py-2 ic-border ic-border-gray-300 ic-rounded-md focus:ic-outline-none focus:ic-ring-2 ic-text-gray-900"
              style={{ '--tw-ring-color': primaryColor }}
              disabled={isLoading}
              autoFocus
            />
          </div>

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
            <form onSubmit={handleContactSubmit}>
          <div className="ic-mb-4">
            <label
              htmlFor="contactNumber"
              className="ic-block ic-text-sm ic-font-medium ic-text-gray-700 ic-mb-2"
            >
              Request Callback
            </label>
            <input
              type="tel"
              id="contactNumber"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g., +65 9123 4567"
              className="ic-w-full ic-px-3 ic-py-2 ic-border ic-border-gray-300 ic-rounded-md focus:ic-outline-none focus:ic-ring-2 ic-text-gray-900"
              style={{ '--tw-ring-color': primaryColor }}
              disabled={isLoading}
            />
            <p className="ic-text-xs ic-text-gray-500 ic-mt-1">
              We'll call you back during office hours
            </p>
          </div>

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
                Submitting...
              </span>
            ) : (
              'Submit Contact Number'
            )}
          </button>
        </form>

            {/* Success Message (inside callback form) */}
            {successMessage && (
              <div className="ic-mt-4 ic-p-3 ic-bg-green-50 ic-border ic-border-green-200 ic-rounded-md">
                <p className="ic-text-sm ic-text-green-600">{successMessage}</p>
              </div>
            )}
          </>
        )}

        {/* Error Message (outside callback form, always visible) */}
        {error && (
          <div className="ic-mt-4 ic-p-3 ic-bg-red-50 ic-border ic-border-red-200 ic-rounded-md">
            <p className="ic-text-sm ic-text-red-600">{error}</p>
          </div>
        )}

        <div className="ic-mt-4 ic-pt-4 ic-border-t ic-border-gray-200">
          <p className="ic-text-xs ic-text-gray-500 ic-text-center">
            helpdesk@inspro.com.sg
          </p>
        </div>
      </div>
    </div>
  );
}
