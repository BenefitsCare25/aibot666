import { useRef, useState } from 'react';
import FileAttachment from './FileAttachment';
import EmailInput from './EmailInput';

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
  onToggleEmailInput
}) {
  const fileInputRef = useRef(null);
  const [emailValid, setEmailValid] = useState(true);

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
    <div className="ic-bg-white ic-border-t ic-border-gray-200">
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
          {/* Paperclip Button */}
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

          {/* Request LOG Button */}
          <button
            onClick={handleRequestLog}
            disabled={disabled || logRequested || (showEmailInput && !emailValid)}
            className="ic-px-3 ic-py-2 ic-text-white ic-rounded-md ic-transition-colors disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-opacity-90 ic-flex ic-items-center ic-gap-1 ic-text-sm ic-whitespace-nowrap ic-flex-shrink-0"
            style={{ backgroundColor: logRequested ? '#4CAF50' : primaryColor }}
            title={logRequested ? 'LOG already requested' : showEmailInput ? 'Submit LOG request with email' : 'Request LOG'}
          >
            {logRequested ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-4 ic-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Sent</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="ic-w-4 ic-h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>LOG</span>
                {attachments.length > 0 && (
                  <span className="ic-bg-white ic-text-blue-600 ic-rounded-full ic-px-1.5 ic-text-xs ic-font-semibold">
                    {attachments.length}
                  </span>
                )}
              </>
            )}
          </button>

          {/* Send Button */}
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

        {/* Helper Text */}
        <p className="ic-text-xs ic-text-gray-500 ic-mt-2">
          Press Enter to send • Shift + Enter for new line
          {attachments.length > 0 && ` • 📎 ${attachments.length} file${attachments.length > 1 ? 's' : ''} attached`}
        </p>
      </div>
    </div>
  );
}
