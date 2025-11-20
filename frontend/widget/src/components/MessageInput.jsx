import { useRef, useState, useEffect } from 'react';
import FileAttachment from './FileAttachment';
import EmailInput from './EmailInput';
import { detectLogContext } from '../utils/logDetection';

export default function MessageInput({
  value,
  onChange,
  onSend,
  onKeyPress,
  disabled,
  primaryColor,
  attachments = [],
  onAddAttachment,
  onRemoveAttachment,
  onRequestLog,
  logRequested,
  userEmail,
  onEmailChange,
  showEmailInput = false,
  onToggleEmailInput,
  isLogMode = false,
  onEnterLogMode,
  onExitLogMode
}) {
  const fileInputRef = useRef(null);
  const [emailValid, setEmailValid] = useState(true);
  const [showLogSuggestion, setShowLogSuggestion] = useState(false);
  const [expandLogButton, setExpandLogButton] = useState(false);

  // Detect LOG context from user input
  useEffect(() => {
    if (value && !isLogMode && !logRequested) {
      const hasLogContext = detectLogContext(value);
      setShowLogSuggestion(hasLogContext);
      setExpandLogButton(hasLogContext);
    } else {
      setShowLogSuggestion(false);
      setExpandLogButton(false);
    }
  }, [value, isLogMode, logRequested]);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        onAddAttachment(file);
      });
      e.target.value = ''; // Reset input
    }
  };

  const handleRequestLog = () => {
    // Show email input if not already shown and no email provided
    if (!showEmailInput && !userEmail) {
      onToggleEmailInput(true);
    } else {
      onRequestLog();
    }
  };

  return (
    <div className="ic-bg-white/95 ic-border-t ic-border-pink-200 ic-backdrop-blur-sm">
      {/* LOG Suggestion Banner (shown when LOG keywords detected) */}
      {showLogSuggestion && !isLogMode && (
        <div className="ic-bg-blue-50 ic-border-b ic-border-blue-200 ic-px-4 ic-py-2 ic-flex ic-items-center ic-gap-2 ic-text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-4 ic-h-4 ic-text-blue-600 ic-flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="ic-text-blue-800 ic-flex-1">
            Need a Letter of Guarantee?
          </span>
          <button
            onClick={onEnterLogMode}
            className="ic-text-blue-600 hover:ic-text-blue-800 ic-font-medium ic-underline ic-flex-shrink-0"
          >
            Request LOG
          </button>
        </div>
      )}

      {/* Email Input (shown when requesting LOG) */}
      {showEmailInput && (
        <EmailInput
          value={userEmail}
          onChange={onEmailChange}
          onBlur={(valid) => setEmailValid(valid)}
        />
      )}

      {/* File Attachments Display */}
      <FileAttachment
        files={attachments}
        onAddFile={onAddAttachment}
        onRemoveFile={onRemoveAttachment}
      />

      {/* Input Area */}
      <div className="ic-p-4">
        <div className="ic-flex ic-gap-2 ic-items-end">
          {/* Paperclip Button - Only show in LOG mode */}
          {isLogMode && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || attachments.length >= 5}
              className="ic-p-2 ic-text-gray-500 hover:ic-text-gray-700 ic-rounded ic-transition-colors disabled:ic-opacity-50 disabled:ic-cursor-not-allowed ic-flex-shrink-0 ic-relative"
              title="Attach file"
              aria-label="Attach file"
            >
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
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
              {attachments.length > 0 && (
                <span className="ic-absolute ic--top-1 ic--right-1 ic-bg-blue-500 ic-text-white ic-text-xs ic-rounded-full ic-w-4 ic-h-4 ic-flex ic-items-center ic-justify-center">
                  {attachments.length}
                </span>
              )}
            </button>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
            onChange={handleFileSelect}
            className="ic-hidden"
          />

          {/* Textarea */}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder="Write your message..."
            disabled={disabled}
            className="ic-flex-1 ic-px-4 ic-py-3 ic-border ic-border-gray-300 ic-rounded-2xl ic-resize-none ic-text-sm focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 focus:ic-border-transparent ic-text-gray-900 ic-shadow-sm ic-bg-white"
            rows={1}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
          />

          {/* LOG Mode: Show Submit and Cancel buttons */}
          {isLogMode ? (
            <div className="ic-flex ic-gap-2">
              <button
                onClick={onExitLogMode}
                disabled={disabled}
                className="ic-px-3 ic-py-2 ic-bg-gray-500 ic-text-white ic-rounded-md ic-transition-colors hover:ic-bg-gray-600 disabled:ic-opacity-50 disabled:ic-cursor-not-allowed ic-flex ic-items-center ic-gap-1 ic-text-sm ic-whitespace-nowrap ic-flex-shrink-0"
                title="Cancel LOG request"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-4 ic-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Cancel</span>
              </button>
              <button
                onClick={handleRequestLog}
                disabled={disabled || (showEmailInput && !emailValid)}
                className="ic-px-3 ic-py-2 ic-text-white ic-rounded-md ic-transition-colors disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-opacity-90 ic-flex ic-items-center ic-gap-1 ic-text-sm ic-whitespace-nowrap ic-flex-shrink-0"
                style={{ backgroundColor: '#4CAF50' }}
                title="Submit LOG request"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-4 ic-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Submit LOG</span>
                {attachments.length > 0 && (
                  <span className="ic-bg-white ic-text-green-600 ic-rounded-full ic-px-1.5 ic-text-xs ic-font-semibold">
                    {attachments.length}
                  </span>
                )}
              </button>
            </div>
          ) : (
            /* Normal Mode: Show LOG button (compact icon or expanded based on context) */
            !logRequested && (
              <button
                onClick={onEnterLogMode}
                disabled={disabled}
                className={`ic-text-white ic-rounded-md ic-transition-all disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-opacity-90 ic-flex ic-items-center ic-gap-1 ic-text-sm ic-whitespace-nowrap ic-flex-shrink-0 ${
                  expandLogButton ? 'ic-px-3 ic-py-2' : 'ic-p-2'
                }`}
                style={{ backgroundColor: primaryColor }}
                title="Request Letter of Guarantee"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-4 ic-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {expandLogButton && <span>LOG Request</span>}
              </button>
            )
          )}

          {/* Send Button - Hide in LOG mode */}
          {!isLogMode && (
            <button
              onClick={onSend}
              disabled={disabled || !value.trim()}
              className="ic-w-12 ic-h-12 ic-text-white ic-rounded-full ic-transition-all disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-shadow-lg ic-transform hover:ic-scale-110 ic-flex ic-items-center ic-justify-center ic-flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #ec4899 0%, #ef4444 50%, #f87171 100%)' }}
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
                className="ic-h-6 ic-w-6 ic-transform ic-rotate-45"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
            </button>
          )}
        </div>

        {/* Helper Text */}
        <p className="ic-text-xs ic-text-gray-500 ic-mt-2">
          {isLogMode ? (
            <>
              Attach files for LOG request
              {attachments.length > 0 && ` • 📎 ${attachments.length} file${attachments.length > 1 ? 's' : ''} attached`}
            </>
          ) : (
            'Press Enter to send • Shift + Enter for new line'
          )}
        </p>
      </div>
    </div>
  );
}
