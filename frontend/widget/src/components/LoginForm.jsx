import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Mail } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import OptionSelector from './login/OptionSelector';
import ChatLoginForm from './login/ChatLoginForm';
import LogRequestForm from './login/LogRequestForm';
import CallbackForm from './login/CallbackForm';
import SuccessScreen from './login/SuccessScreen';
import PrivacyPolicyModal from './PrivacyPolicyModal';

export default function LoginForm({ onLogin, onClose, primaryColor, isEmbedded = false, isMobileFullScreen = false, isInIframe = false }) {
  const containerStyle = isMobileFullScreen
    ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }
    : isEmbedded
      ? {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }
      : isInIframe
        ? {
            width: '100%',
            maxWidth: 380,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(231, 76, 94, 0.16)'
          }
        : {
            width: '100%',
            maxWidth: 450,
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(231, 76, 94, 0.16)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: '#ffffff'
          };

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
  const [logSubmitted, setLogSubmitted] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const { createSession, apiUrl, domain: companyDomain } = useChatStore();

  const getDomain = () => companyDomain || window.location.hostname;

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
      const isEmployeeValidationError =
        errorMessage.includes('Employee not found') ||
        errorMessage.includes('employee not found') ||
        errorMessage.includes('Failed to create session');

      if (isEmployeeValidationError) {
        setError('Invalid credentials, please contact helpdesk at 64487707');
        setShowCallbackForm(true);
      } else {
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

    const phoneRegex = /^\+?[\d\s\-()]{8,}$/;
    if (!phoneRegex.test(contactNumber.trim())) {
      setError('Please enter a valid contact number');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/chat/callback-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Widget-Domain': getDomain()
        },
        body: JSON.stringify({
          contactNumber: contactNumber.trim(),
          employeeId: identifier || null
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
        throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
      }

      setSuccessMessage('Our team will contact you within the next working day');
      setContactNumber('');
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
        if (file.size > 10 * 1024 * 1024) {
          setError(`File ${file.name} is too large. Maximum size is 10MB.`);
          continue;
        }

        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(logEmail.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/chat/anonymous-log-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Widget-Domain': getDomain()
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
        throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
      }

      setSuccessMessage('Your LOG request has been submitted successfully. You will receive a confirmation email shortly.');
      setLogSubmitted(true);
    } catch (err) {
      console.error('Error submitting LOG request:', err);
      setError(err.message || 'Failed to submit LOG request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnother = () => {
    setLogSubmitted(false);
    setLogEmail('');
    setLogDescription('');
    setLogAttachments([]);
    setSuccessMessage('');
    setError('');
    setSelectedOption(null);
  };

  return (
    <div style={containerStyle} data-chat-content>
      {/* Header */}
      <div
        className="ic-p-4 sm:ic-p-6 ic-text-white ic-relative ic-flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)',
          borderRadius: (isEmbedded || isMobileFullScreen) ? 0 : undefined
        }}
      >
        <div className="ic-flex ic-items-start ic-justify-between">
          <div className="ic-flex-1">
            <h3 className="ic-text-lg sm:ic-text-2xl ic-font-medium ic-mb-0.5 sm:ic-mb-1">
              Hi there <span className="ic-inline-block ic-animate-wave">&#128075;</span>
            </h3>
            <h2 className="ic-text-2xl sm:ic-text-4xl ic-font-bold ic-leading-tight">
              How can we help?
            </h2>
            <span className="ic-inline-flex ic-items-center ic-gap-1.5 ic-mt-2"
              style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>
              <span style={{
                backgroundColor: 'rgba(255,255,255,0.25)',
                padding: '2px 8px',
                borderRadius: 8,
                letterSpacing: '0.5px'
              }}>BETA</span>
              AI Assistant
            </span>
          </div>
          <button
            onClick={onClose}
            className="ic-text-white hover:ic-bg-white/20 ic-rounded-full ic-p-2 ic-transition-all ic-duration-200 ic-ml-4 ic-min-w-[44px] ic-min-h-[44px] ic-flex ic-items-center ic-justify-center"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            aria-label="Minimize"
          >
            <ChevronDown className="ic-w-6 ic-h-6" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          padding: 24,
          paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          backgroundColor: '#ffffff'
        }}
      >
        {/* Non-blocking disclaimer notice */}
        <div
          className="ic-rounded-lg ic-p-3 ic-mb-4"
          style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
        >
          <p className="ic-text-xs ic-leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            All conversations are recorded for quality assurance. This assistant provides
            general information only and should not be considered professional insurance advice.
            By using this assistant, you agree to our{' '}
            <button
              onClick={() => setShowPrivacyPolicy(true)}
              className="ic-font-medium hover:ic-underline"
              style={{ color: 'var(--color-primary-500)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
            >
              Terms of Use
            </button>.
          </p>
        </div>

        {selectedOption === null && (
          <OptionSelector
            onSelectChat={() => setSelectedOption('chat')}
            onSelectLog={() => setSelectedOption('log')}
          />
        )}

        {selectedOption === 'chat' && (
          <ChatLoginForm
            identifier={identifier}
            setIdentifier={setIdentifier}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            onBack={() => setSelectedOption(null)}
          />
        )}

        {selectedOption === 'log' && !logSubmitted && (
          <LogRequestForm
            logEmail={logEmail}
            setLogEmail={setLogEmail}
            logDescription={logDescription}
            setLogDescription={setLogDescription}
            logAttachments={logAttachments}
            uploadingFile={uploadingFile}
            isLoading={isLoading}
            onSubmit={handleLogRequestSubmit}
            onFileUpload={handleFileUpload}
            onRemoveAttachment={removeAttachment}
            onBack={() => setSelectedOption(null)}
          />
        )}

        {selectedOption === 'log' && logSubmitted && (
          <SuccessScreen
            email={logEmail}
            onClose={onClose}
            onSubmitAnother={handleSubmitAnother}
          />
        )}

        {/* Callback Form (shown after failed login) */}
        <AnimatePresence>
          {showCallbackForm && (
            <CallbackForm
              contactNumber={contactNumber}
              setContactNumber={setContactNumber}
              isLoading={isLoading}
              successMessage={successMessage}
              onSubmit={handleContactSubmit}
            />
          )}
        </AnimatePresence>

        {/* Error Message */}
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
            <span style={{ margin: '0 4px' }}>|</span>
            <button
              onClick={() => setShowPrivacyPolicy(true)}
              className="hover:ic-underline"
              style={{ color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
            >
              Terms of Use
            </button>
          </p>
        </div>
      </div>

      <PrivacyPolicyModal
        isOpen={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
      />
    </div>
  );
}
