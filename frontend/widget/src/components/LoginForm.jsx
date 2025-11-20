import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Mail, Phone, Loader2 } from 'lucide-react';
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
    <motion.div
      className="ic-rounded-2xl ic-shadow-soft-lg ic-w-[450px] ic-overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)'
      }}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: "spring", duration: 0.5 }}
    >
      {/* Header with Red Gradient */}
      <motion.div
        className="ic-p-4 ic-text-white ic-relative"
        style={{ background: 'var(--gradient-primary)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="ic-flex ic-items-center ic-justify-between">
          <div className="ic-flex ic-items-center ic-gap-3">
            <div className="ic-w-10 ic-h-10 ic-bg-white/20 ic-rounded-full ic-flex ic-items-center ic-justify-center ic-backdrop-blur-sm ic-border-2 ic-border-white/30">
              <MessageCircle className="ic-w-6 ic-h-6" strokeWidth={2} />
            </div>
            <div>
              <h3 className="ic-text-lg ic-font-bold ic-tracking-tight">Welcome, chat with us</h3>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 ic-transition-all ic-duration-200"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Close"
          >
            <X className="ic-w-5 ic-h-5" strokeWidth={2} />
          </motion.button>
        </div>
      </motion.div>

      {/* Login Form */}
      <motion.div
        className="ic-p-6"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <form onSubmit={handleSubmit} className="ic-space-y-4">
          <div>
            <label
              htmlFor="identifier"
              className="ic-block ic-text-sm ic-font-semibold ic-mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Employee ID / User ID / Email
            </label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g., EMP001 or user@example.com"
              className="ic-w-full ic-px-4 ic-py-3 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all"
              style={{
                backgroundColor: '#ffffff',
                border: 'none',
                color: 'var(--color-text-primary)'
              }}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <motion.button
            type="submit"
            disabled={isLoading}
            className="ic-w-full ic-text-white ic-py-3 ic-px-4 ic-rounded-xl ic-font-semibold ic-transition-all disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-shadow-soft-lg"
            style={{ background: 'var(--gradient-primary)' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <span className="ic-flex ic-items-center ic-justify-center ic-gap-2">
                <Loader2 className="ic-animate-spin ic-h-4 ic-w-4" />
                Starting...
              </span>
            ) : (
              'Start Chat'
            )}
          </motion.button>
        </form>

        {/* Show callback form only when employee ID validation fails */}
        <AnimatePresence>
          {showCallbackForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Divider */}
              <div className="ic-my-4 ic-flex ic-items-center">
                <div
                  className="ic-flex-1 ic-border-t"
                  style={{ borderColor: 'var(--color-border)' }}
                ></div>
                <span
                  className="ic-px-3 ic-text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  OR
                </span>
                <div
                  className="ic-flex-1 ic-border-t"
                  style={{ borderColor: 'var(--color-border)' }}
                ></div>
              </div>

              {/* Contact Number Form */}
              <form onSubmit={handleContactSubmit} className="ic-space-y-4">
                <div>
                  <label
                    htmlFor="contactNumber"
                    className="ic-block ic-text-sm ic-font-semibold ic-mb-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Request Callback
                  </label>
                  <div className="ic-relative">
                    <div className="ic-absolute ic-left-3 ic-top-1/2 ic-transform ic--translate-y-1/2">
                      <Phone
                        className="ic-w-4 ic-h-4"
                        style={{ color: 'var(--color-text-tertiary)' }}
                        strokeWidth={2}
                      />
                    </div>
                    <input
                      type="tel"
                      id="contactNumber"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="e.g., +65 9123 4567"
                      className="ic-w-full ic-pl-10 ic-pr-4 ic-py-3 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all"
                      style={{
                        backgroundColor: '#ffffff',
                        border: 'none',
                        color: 'var(--color-text-primary)'
                      }}
                      disabled={isLoading}
                    />
                  </div>
                  <p
                    className="ic-text-xs ic-mt-2 ic-italic"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    We'll call you back during office hours
                  </p>
                </div>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className="ic-w-full ic-text-white ic-py-3 ic-px-4 ic-rounded-xl ic-font-semibold ic-transition-all disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-shadow-soft-lg"
                  style={{ background: 'var(--gradient-primary)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? (
                    <span className="ic-flex ic-items-center ic-justify-center ic-gap-2">
                      <Loader2 className="ic-animate-spin ic-h-4 ic-w-4" />
                      Submitting...
                    </span>
                  ) : (
                    'Submit Contact Number'
                  )}
                </motion.button>
              </form>

              {/* Success Message (inside callback form) */}
              <AnimatePresence>
                {successMessage && (
                  <motion.div
                    className="ic-mt-4 ic-p-4 ic-bg-green-50 ic-border-l-4 ic-border-green-500 ic-rounded-lg ic-shadow-soft"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <p className="ic-text-sm ic-text-green-700 ic-font-medium">{successMessage}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message (outside callback form, always visible) */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="ic-mt-4 ic-p-4 ic-bg-red-50 ic-border-l-4 ic-border-red-500 ic-rounded-lg ic-shadow-soft"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <p className="ic-text-sm ic-text-red-700 ic-font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="ic-mt-6 ic-pt-4 ic-border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <p
            className="ic-text-xs ic-text-center ic-flex ic-items-center ic-justify-center ic-gap-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Mail className="ic-w-4 ic-h-4" strokeWidth={2} />
            helpdesk@inspro.com.sg
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
