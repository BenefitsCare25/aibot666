import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Mail, Phone, Loader2, FileText, ArrowRight, Paperclip, Upload } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

export default function LoginForm({ onLogin, onClose, primaryColor }) {
  const [identifier, setIdentifier] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null); // null | 'chat' | 'log'
  const [logEmail, setLogEmail] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [logAttachments, setLogAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
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

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);

    if (logAttachments.length + files.length > 5) {
      setError('Maximum 5 files allowed');
      return;
    }

    setUploadingFile(true);
    setError('');

    try {
      for (const file of files) {
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError(`File ${file.name} is too large. Maximum size is 10MB.`);
          continue;
        }

        // Convert file to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data:mime;base64, prefix
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;

        setLogAttachments(prev => [...prev, {
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          size: file.size,
          mimetype: file.type,
          base64: base64
        }]);
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to process file. Please try again.');
    } finally {
      setUploadingFile(false);
      // Reset file input
      e.target.value = null;
    }
  };

  const removeAttachment = (id) => {
    setLogAttachments(prev => prev.filter(att => att.id !== id));
  };

  const handleLogRequestSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!logEmail.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(logEmail.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const domain = companyDomain || window.location.hostname;

      const response = await fetch(`${apiUrl}/api/chat/anonymous-log-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Widget-Domain': domain
        },
        body: JSON.stringify({
          email: logEmail.trim(),
          description: logDescription.trim(),
          employeeId: identifier || null,
          attachments: logAttachments
        })
      });

      const responseText = await response.text();

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error(`Server returned invalid response: ${responseText || 'Empty response'}`);
      }

      if (!response.ok) {
        const errorMessage = data.error || `Server error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      setSuccessMessage('Your LOG request has been submitted successfully. You will receive a confirmation email shortly.');
      setLogEmail('');
      setLogDescription('');
      setLogAttachments([]);
    } catch (err) {
      console.error('Error submitting LOG request:', err);
      setError(err.message || 'Failed to submit LOG request. Please try again.');
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
        className="ic-p-6 ic-text-white ic-relative"
        style={{ background: 'var(--gradient-primary)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="ic-flex ic-items-start ic-justify-between">
          <div className="ic-flex-1">
            <h3 className="ic-text-2xl ic-font-medium ic-mb-1">
              Hi there <span className="ic-inline-block ic-animate-wave">👋</span>
            </h3>
            <h2 className="ic-text-4xl ic-font-bold ic-leading-tight">
              How can we help?
            </h2>
          </div>
          <motion.button
            onClick={onClose}
            className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 ic-transition-all ic-duration-200 ic-ml-4"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Close"
          >
            <X className="ic-w-5 ic-h-5" strokeWidth={2} />
          </motion.button>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div
        className="ic-p-6"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Show option cards when no option is selected */}
        {selectedOption === null && (
          <div className="ic-space-y-3">
            {/* Chat Option Card */}
            <motion.button
              onClick={() => setSelectedOption('chat')}
              className="ic-w-full ic-p-4 ic-rounded-xl ic-bg-white ic-shadow-soft hover:ic-shadow-soft-lg ic-transition-all ic-flex ic-items-center ic-justify-between ic-group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="ic-text-base ic-font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Send us a message
              </span>
              <ArrowRight className="ic-w-5 ic-h-5 group-hover:ic-translate-x-1 ic-transition-transform" style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2} />
            </motion.button>

            {/* LOG Request Option Card */}
            <motion.button
              onClick={() => setSelectedOption('log')}
              className="ic-w-full ic-p-4 ic-rounded-xl ic-bg-white ic-shadow-soft hover:ic-shadow-soft-lg ic-transition-all ic-flex ic-items-center ic-justify-between ic-group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="ic-flex ic-items-center ic-gap-3">
                <FileText className="ic-w-5 ic-h-5" style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2} />
                <span className="ic-text-base ic-font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Request Letter of Guarantee
                </span>
              </div>
              <ArrowRight className="ic-w-5 ic-h-5 group-hover:ic-translate-x-1 ic-transition-transform" style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2} />
            </motion.button>
          </div>
        )}

        {/* Chat Form */}
        {selectedOption === 'chat' && (
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

          {/* Back button */}
          <button
            type="button"
            onClick={() => setSelectedOption(null)}
            className="ic-w-full ic-text-sm ic-py-2 ic-text-center ic-transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            ← Back to options
          </button>
        </form>
        )}

        {/* LOG Request Form */}
        {selectedOption === 'log' && (
          <form onSubmit={handleLogRequestSubmit} className="ic-space-y-4">
            <div>
              <label
                htmlFor="logEmail"
                className="ic-block ic-text-sm ic-font-semibold ic-mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Email Address *
              </label>
              <input
                type="email"
                id="logEmail"
                value={logEmail}
                onChange={(e) => setLogEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="ic-w-full ic-px-4 ic-py-3 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all"
                style={{
                  backgroundColor: '#ffffff',
                  border: 'none',
                  color: 'var(--color-text-primary)'
                }}
                disabled={isLoading}
                autoFocus
                required
              />
            </div>

            <div>
              <label
                htmlFor="logDescription"
                className="ic-block ic-text-sm ic-font-semibold ic-mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Description / Additional Details
              </label>
              <textarea
                id="logDescription"
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                placeholder="Please provide details about your LOG request..."
                rows={4}
                className="ic-w-full ic-px-4 ic-py-3 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all ic-resize-none"
                style={{
                  backgroundColor: '#ffffff',
                  border: 'none',
                  color: 'var(--color-text-primary)'
                }}
                disabled={isLoading}
              />
              <p
                className="ic-text-xs ic-mt-2 ic-italic"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Optional: Provide any relevant information that may help us process your request
              </p>
            </div>

            {/* File Upload Section */}
            <div>
              <label
                className="ic-block ic-text-sm ic-font-semibold ic-mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Attachments (Optional)
              </label>

              {/* File Upload Button */}
              <label
                htmlFor="logFileUpload"
                className={`ic-flex ic-items-center ic-justify-center ic-gap-2 ic-w-full ic-px-4 ic-py-3 ic-rounded-xl ic-border-2 ic-border-dashed ic-transition-all ic-cursor-pointer ${
                  uploadingFile || isLoading ? 'ic-opacity-50 ic-cursor-not-allowed' : 'hover:ic-border-red-400 hover:ic-bg-red-50'
                }`}
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)'
                }}
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="ic-w-5 ic-h-5 ic-animate-spin" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="ic-text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Processing...
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="ic-w-5 ic-h-5" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="ic-text-sm ic-font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      Click to upload files
                    </span>
                  </>
                )}
              </label>
              <input
                id="logFileUpload"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                onChange={handleFileUpload}
                disabled={uploadingFile || isLoading || logAttachments.length >= 5}
                className="ic-hidden"
              />
              <p
                className="ic-text-xs ic-mt-2 ic-italic"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Max 5 files, 10MB each. Supported: PDF, DOC, XLS, Images
              </p>

              {/* Display uploaded files */}
              {logAttachments.length > 0 && (
                <div className="ic-mt-3 ic-space-y-2">
                  {logAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="ic-flex ic-items-center ic-justify-between ic-p-2 ic-rounded-lg ic-bg-white ic-shadow-soft"
                    >
                      <div className="ic-flex ic-items-center ic-gap-2 ic-flex-1 ic-min-w-0">
                        <Paperclip className="ic-w-4 ic-h-4 ic-flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                        <span
                          className="ic-text-sm ic-truncate"
                          style={{ color: 'var(--color-text-primary)' }}
                          title={attachment.name}
                        >
                          {attachment.name}
                        </span>
                        <span
                          className="ic-text-xs ic-flex-shrink-0"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          ({(attachment.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        disabled={isLoading}
                        className="ic-ml-2 ic-p-1 ic-rounded-full hover:ic-bg-red-50 ic-transition-colors disabled:ic-opacity-50"
                        aria-label="Remove attachment"
                      >
                        <X className="ic-w-4 ic-h-4 ic-text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={isLoading || uploadingFile}
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
                'Submit LOG Request'
              )}
            </motion.button>

            {/* Back button */}
            <button
              type="button"
              onClick={() => setSelectedOption(null)}
              className="ic-w-full ic-text-sm ic-py-2 ic-text-center ic-transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              ← Back to options
            </button>
          </form>
        )}

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
