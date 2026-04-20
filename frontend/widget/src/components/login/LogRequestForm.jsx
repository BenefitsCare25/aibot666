import { motion } from 'framer-motion';
import { Loader2, Paperclip, X, Download, FileText, AlertTriangle } from 'lucide-react';

export default function LogRequestForm({
  logEmail,
  setLogEmail,
  logDescription,
  setLogDescription,
  logAttachments,
  uploadingFile,
  isLoading,
  onSubmit,
  onFileUpload,
  onRemoveAttachment,
  onBack,
  logRoute = null,
  apiUrl = '',
  domain = '',
  fileWarnings = [],
  requiredFields = [],
  fieldValues = {},
  onFieldChange,
  fieldErrors = {},
}) {
  const handleDownload = (downloadKey) => {
    if (!downloadKey || !apiUrl) return;
    const domainParam = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    const url = `${apiUrl}/api/chat/log-form/${downloadKey}${domainParam}`;
    window.parent.postMessage({ type: 'chatWidgetDownload', url, filename: `${downloadKey}.pdf` }, '*');
  };

  const hasRoutes = !!logRoute;
  const hasRequiredFields = requiredFields.length > 0;
  const backLabel = hasRoutes ? '\u2190 Back to hospital type' : '\u2190 Back to options';
  const hasRequiredDocs = logRoute?.requiredDocuments?.length > 0;

  return (
    <form onSubmit={onSubmit} className="ic-space-y-3">
      {/* Required documents checklist with download links */}
      {hasRequiredDocs && (
        <div
          className="ic-rounded-xl ic-p-3"
          style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
        >
          <div className="ic-flex ic-items-center ic-gap-2 ic-mb-2">
            <FileText className="ic-w-4 ic-h-4" style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2} />
            <span className="ic-text-xs ic-font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Required documents:
            </span>
          </div>
          <ul className="ic-space-y-1.5">
            {logRoute.requiredDocuments.map((doc, idx) => (
              <li key={idx} className="ic-flex ic-items-start ic-gap-2">
                <span className="ic-text-xs ic-mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                <div className="ic-flex-1">
                  <span className="ic-text-xs ic-font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {doc.name}
                  </span>
                  {doc.description && (
                    <p className="ic-text-xs" style={{ color: 'var(--color-text-tertiary)', whiteSpace: 'pre-line' }}>
                      {doc.description}
                    </p>
                  )}
                  {doc.downloadKey && (
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.downloadKey)}
                      className="ic-inline-flex ic-items-center ic-gap-1 ic-text-xs ic-font-medium ic-mt-0.5 hover:ic-underline"
                      style={{ color: 'var(--color-primary-500)' }}
                    >
                      <Download className="ic-w-3 ic-h-3" strokeWidth={2} />
                      Download form
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dynamic required fields (no section header) */}
      {requiredFields.map((field) => (
        <div key={field.id}>
          <label
            htmlFor={`field-${field.id}`}
            className="ic-block ic-text-sm ic-font-medium ic-mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {field.label}{field.required !== false ? ' *' : ''}
          </label>
          {field.type === 'date' ? (
            <input
              type="date"
              id={`field-${field.id}`}
              value={fieldValues[field.id] || ''}
              onChange={(e) => onFieldChange?.(field.id, e.target.value)}
              className="ic-w-full ic-px-3 ic-py-2 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all"
              style={{
                backgroundColor: '#ffffff',
                border: fieldErrors[field.id] ? '1px solid #ef4444' : 'none',
                color: 'var(--color-text-primary)'
              }}
              disabled={isLoading}
            />
          ) : field.type === 'textarea' ? (
            <textarea
              id={`field-${field.id}`}
              value={fieldValues[field.id] || ''}
              onChange={(e) => onFieldChange?.(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              rows={2}
              className="ic-w-full ic-px-3 ic-py-2 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all ic-resize-none"
              style={{
                backgroundColor: '#ffffff',
                border: fieldErrors[field.id] ? '1px solid #ef4444' : 'none',
                color: 'var(--color-text-primary)'
              }}
              disabled={isLoading}
            />
          ) : (
            <input
              type="text"
              id={`field-${field.id}`}
              value={fieldValues[field.id] || ''}
              onChange={(e) => onFieldChange?.(field.id, e.target.value)}
              placeholder={field.placeholder || ''}
              className="ic-w-full ic-px-3 ic-py-2 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all"
              style={{
                backgroundColor: '#ffffff',
                border: fieldErrors[field.id] ? '1px solid #ef4444' : 'none',
                color: 'var(--color-text-primary)'
              }}
              disabled={isLoading}
            />
          )}
          {fieldErrors[field.id] && (
            <p className="ic-text-xs ic-mt-0.5" style={{ color: '#ef4444' }}>
              {fieldErrors[field.id]}
            </p>
          )}
        </div>
      ))}

      <div>
        <label
          htmlFor="logEmail"
          className="ic-block ic-text-sm ic-font-medium ic-mb-1"
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
          className="ic-w-full ic-px-3 ic-py-2 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all"
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

      {/* Description - hidden when required fields exist (they capture structured info instead) */}
      {!hasRequiredFields && (
        <div>
          <label
            htmlFor="logDescription"
            className="ic-block ic-text-sm ic-font-medium ic-mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Description / Additional Details
          </label>
          <textarea
            id="logDescription"
            value={logDescription}
            onChange={(e) => setLogDescription(e.target.value)}
            placeholder="Please provide details about your LOG request..."
            rows={3}
            className="ic-w-full ic-px-3 ic-py-2 ic-rounded-xl focus:ic-outline-none focus:ic-ring-2 focus:ic-ring-red-400 ic-shadow-soft ic-transition-all ic-resize-none"
            style={{
              backgroundColor: '#ffffff',
              border: 'none',
              color: 'var(--color-text-primary)'
            }}
            disabled={isLoading}
          />
          {!logRoute && (
            <p
              className="ic-text-xs ic-mt-1 ic-italic"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Attach Financial Care Cost/Pre-admission Hospital Form
            </p>
          )}
        </div>
      )}

      {/* Attached files list */}
      {logAttachments.length > 0 && (
        <div className="ic-space-y-1.5">
          {logAttachments.map((attachment) => (
            <div
              key={attachment.id}
              className="ic-flex ic-items-center ic-justify-between ic-p-1.5 ic-rounded-lg ic-bg-white ic-shadow-soft"
            >
              <div className="ic-flex ic-items-center ic-gap-1.5 ic-flex-1 ic-min-w-0">
                <Paperclip className="ic-w-3.5 ic-h-3.5 ic-flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                <span
                  className="ic-text-xs ic-truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                  title={attachment.name}
                >
                  {attachment.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveAttachment(attachment.id)}
                disabled={isLoading}
                className="ic-ml-1 ic-p-0.5 ic-rounded-full hover:ic-bg-red-50 ic-transition-colors disabled:ic-opacity-50"
                aria-label="Remove attachment"
              >
                <X className="ic-w-3.5 ic-h-3.5 ic-text-red-600" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Document validation warning */}
      {fileWarnings.length > 0 && (
        <div
          className="ic-rounded-xl ic-p-2.5"
          style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}
        >
          <div className="ic-flex ic-items-start ic-gap-2">
            <AlertTriangle className="ic-w-4 ic-h-4 ic-flex-shrink-0 ic-mt-0.5" style={{ color: '#d97706' }} strokeWidth={2} />
            <p className="ic-text-xs ic-font-semibold" style={{ color: '#92400e' }}>
              {fileWarnings[0]?.reason === 'required'
                ? 'Please upload the required LOG document(s) before submitting.'
                : 'Please submit other claims on the portal.'}
            </p>
          </div>
        </div>
      )}

      {/* Submit + Attach row */}
      <div className="ic-flex ic-items-center ic-gap-2">
        {/* Paperclip attach button */}
        <label
          htmlFor="logFileUpload"
          className={`ic-flex ic-items-center ic-justify-center ic-w-10 ic-h-10 ic-rounded-xl ic-transition-all ic-flex-shrink-0 ${
            uploadingFile || isLoading || logAttachments.length >= 5
              ? 'ic-opacity-50 ic-cursor-not-allowed'
              : 'ic-cursor-pointer hover:ic-bg-red-50'
          }`}
          style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          title={logAttachments.length >= 5 ? 'Max 5 files' : 'Attach files (PDF, DOC, XLS, Images)'}
        >
          {uploadingFile ? (
            <Loader2 className="ic-w-5 ic-h-5 ic-animate-spin" style={{ color: 'var(--color-text-secondary)' }} />
          ) : (
            <Paperclip className="ic-w-5 ic-h-5" style={{ color: 'var(--color-text-secondary)' }} />
          )}
        </label>
        <input
          id="logFileUpload"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
          onChange={onFileUpload}
          disabled={uploadingFile || isLoading || logAttachments.length >= 5}
          className="ic-hidden"
        />

        <motion.button
          type="submit"
          disabled={isLoading || uploadingFile}
          className="ic-flex-1 ic-text-white ic-py-2.5 ic-px-4 ic-rounded-xl ic-font-semibold ic-transition-all disabled:ic-opacity-50 disabled:ic-cursor-not-allowed hover:ic-shadow-soft-lg"
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
      </div>

      {logAttachments.length > 0 && (
        <p className="ic-text-xs ic-italic ic-text-center" style={{ color: 'var(--color-text-tertiary)' }}>
          {logAttachments.length}/5 files attached
        </p>
      )}

      <button
        type="button"
        onClick={onBack}
        className="ic-w-full ic-text-sm ic-py-1 ic-text-center ic-transition-colors"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        {backLabel}
      </button>
    </form>
  );
}
