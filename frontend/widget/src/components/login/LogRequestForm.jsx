import { motion } from 'framer-motion';
import { Loader2, Upload, Paperclip, X, Download, FileText, ArrowLeft } from 'lucide-react';

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
}) {
  const handleDownload = (downloadKey) => {
    if (downloadKey && apiUrl) {
      window.open(`${apiUrl}/api/chat/log-form/${downloadKey}`, '_blank');
    }
  };

  const hasRoutes = !!logRoute;
  const backLabel = hasRoutes ? '\u2190 Back to hospital type' : '\u2190 Back to options';

  return (
    <form onSubmit={onSubmit} className="ic-space-y-4">
      {/* Route info + required documents */}
      {logRoute && (
        <div
          className="ic-rounded-xl ic-p-3"
          style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
        >
          <div className="ic-flex ic-items-center ic-gap-2 ic-mb-2">
            <FileText className="ic-w-4 ic-h-4" style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2} />
            <span className="ic-text-sm ic-font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {logRoute.label}
            </span>
          </div>

          {logRoute.requiredDocuments?.length > 0 && (
            <>
              <p className="ic-text-xs ic-font-medium ic-mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Required documents:
              </p>
              <ul className="ic-space-y-1.5">
                {logRoute.requiredDocuments.map((doc, idx) => (
                  <li key={idx} className="ic-flex ic-items-start ic-gap-2">
                    <span className="ic-text-xs ic-mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                    <div className="ic-flex-1">
                      <span className="ic-text-xs ic-font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {doc.name}
                      </span>
                      {doc.description && (
                        <p className="ic-text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
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
            </>
          )}
        </div>
      )}

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
        {!logRoute && (
          <p
            className="ic-text-xs ic-mt-2 ic-italic"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Attach Financial Care Cost/Pre-admission Hospital Form
          </p>
        )}
      </div>

      {/* File Upload Section */}
      <div>
        <label
          className="ic-block ic-text-sm ic-font-semibold ic-mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Attachments (Optional)
        </label>

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
          onChange={onFileUpload}
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
                  onClick={() => onRemoveAttachment(attachment.id)}
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

      <button
        type="button"
        onClick={onBack}
        className="ic-w-full ic-text-sm ic-py-2 ic-text-center ic-transition-colors"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        {backLabel}
      </button>
    </form>
  );
}
