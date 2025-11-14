import { useState, useEffect } from 'react';
import { companyApi } from '../api/companies';

export default function EmailConfigModal({ company, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailConfig, setEmailConfig] = useState({
    log_request_email_to: '',
    log_request_email_cc: '',
    log_request_keywords: [],
    callback_email_to: '',
    callback_email_cc: ''
  });

  useEffect(() => {
    if (company) {
      setEmailConfig({
        log_request_email_to: company.log_request_email_to || '',
        log_request_email_cc: company.log_request_email_cc || '',
        log_request_keywords: company.log_request_keywords || ['request log', 'send logs', 'need log'],
        callback_email_to: company.callback_email_to || company.log_request_email_to || '',
        callback_email_cc: company.callback_email_cc || company.log_request_email_cc || ''
      });
    }
  }, [company]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await companyApi.updateEmailConfig(company.id, emailConfig);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error updating email config:', err);
      setError(err.response?.data?.error || 'Failed to update email configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordsChange = (value) => {
    // Split by comma and trim each keyword
    const keywords = value.split(',').map(k => k.trim()).filter(Boolean);
    setEmailConfig({ ...emailConfig, log_request_keywords: keywords });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            Email Configuration - {company?.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Support Team Email (To) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Support Team Email(s) - To *
            </label>
            <input
              type="text"
              required
              value={emailConfig.log_request_email_to}
              onChange={(e) => setEmailConfig({ ...emailConfig, log_request_email_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="support@company.com, team@company.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Primary recipients - comma-separated email addresses
            </p>
          </div>

          {/* CC Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CC Recipients (Optional)
            </label>
            <input
              type="text"
              value={emailConfig.log_request_email_cc}
              onChange={(e) => setEmailConfig({ ...emailConfig, log_request_email_cc: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="manager@company.com, supervisor@company.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              CC recipients - comma-separated email addresses (optional)
            </p>
          </div>

          {/* LOG Request Keywords */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LOG Request Keywords
            </label>
            <input
              type="text"
              value={emailConfig.log_request_keywords?.join(', ') || ''}
              onChange={(e) => handleKeywordsChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="request log, send logs, need log"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated keywords that trigger LOG request mode
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 pt-4 mt-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Callback Request Configuration</h3>
            <p className="text-sm text-gray-600 mb-4">
              Configure email notifications for callback requests from users who cannot login
            </p>
          </div>

          {/* Callback Email (To) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Callback Notification Email(s) - To
            </label>
            <input
              type="text"
              value={emailConfig.callback_email_to}
              onChange={(e) => setEmailConfig({ ...emailConfig, callback_email_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="support@company.com (defaults to LOG request email if empty)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Primary recipients for callback requests - comma-separated (optional, falls back to LOG request email)
            </p>
          </div>

          {/* Callback CC Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Callback CC Recipients (Optional)
            </label>
            <input
              type="text"
              value={emailConfig.callback_email_cc}
              onChange={(e) => setEmailConfig({ ...emailConfig, callback_email_cc: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="manager@company.com, supervisor@company.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              CC recipients for callback notifications - comma-separated (optional)
            </p>
          </div>

          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">How Email Notifications Work:</p>
                <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>LOG Requests:</strong> When users request LOG via button or keywords, an email with conversation history and attachments is sent</li>
                  <li><strong>Callback Requests:</strong> When users submit a callback request (cannot login), an email and Telegram notification are sent</li>
                  <li><strong>To:</strong> Primary support team members who handle the requests</li>
                  <li><strong>CC:</strong> Optional additional recipients (managers, supervisors, etc.)</li>
                  <li>Users receive acknowledgment emails with reference IDs</li>
                  <li>Each company can have different email configurations for LOG and callback requests</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          {emailConfig.log_request_email_to && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">📧 Configuration Preview:</p>
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <p className="font-semibold text-gray-800">LOG Requests:</p>
                  <p><span className="font-medium">To:</span> {emailConfig.log_request_email_to}</p>
                  {emailConfig.log_request_email_cc && (
                    <p><span className="font-medium">CC:</span> {emailConfig.log_request_email_cc}</p>
                  )}
                  <p><span className="font-medium">Keywords:</span> {emailConfig.log_request_keywords?.join(', ') || 'None'}</p>
                </div>
                <div className="border-t pt-2">
                  <p className="font-semibold text-gray-800">Callback Requests:</p>
                  <p><span className="font-medium">To:</span> {emailConfig.callback_email_to || emailConfig.log_request_email_to + ' (fallback)'}</p>
                  {(emailConfig.callback_email_cc || emailConfig.log_request_email_cc) && (
                    <p><span className="font-medium">CC:</span> {emailConfig.callback_email_cc || emailConfig.log_request_email_cc + ' (fallback)'}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors mt-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors mt-4 ${
                loading
                  ? 'bg-primary-400 text-white cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Configuration'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
