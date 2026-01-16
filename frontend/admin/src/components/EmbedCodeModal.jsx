import { useState, useEffect } from 'react';
import { companyApi } from '../api/companies';

export default function EmbedCodeModal({ company, onClose }) {
  const [embedData, setEmbedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadEmbedCode();
  }, [company.id]);

  const loadEmbedCode = async () => {
    try {
      setLoading(true);
      const response = await companyApi.getEmbedCode(company.id);
      setEmbedData(response.data);
      setError('');
    } catch (err) {
      console.error('Error loading embed code:', err);
      setError('Failed to load embed code');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full">
          <div className="flex justify-center items-center h-32">
            <div className="text-gray-500">Loading embed code...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Widget Embed Code</h2>
            <p className="text-gray-600 mt-1">
              {embedData.company.name} ({embedData.company.domain})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Info Banner */}
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Iframe Sandbox:</strong> This embed runs in an isolated iframe with restricted permissions.
            Updates are automatic - no code changes needed on client sites.
          </p>
        </div>

        {/* Code Display */}
        <div className="mb-6">
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono">
              <code>{embedData.embedCode.iframe}</code>
            </pre>
            <button
              onClick={() => copyToClipboard(embedData.embedCode.iframe)}
              className={`absolute top-3 right-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <span>📋</span> Implementation Instructions
          </h3>
          <div className="text-sm text-gray-700 space-y-2 whitespace-pre-line">
            {embedData.instructions}
          </div>
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Company Domains</h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Primary:</span>{' '}
                <code className="bg-white px-2 py-0.5 rounded">{embedData.company.domain}</code>
              </div>
              {embedData.company.additional_domains?.length > 0 && (
                <div>
                  <span className="font-medium">Additional:</span>
                  <ul className="mt-1 ml-4 list-disc">
                    {embedData.company.additional_domains.map((domain, idx) => (
                      <li key={idx}>
                        <code className="bg-white px-2 py-0.5 rounded">{domain}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Widget Features</h4>
            <div className="space-y-1 text-sm text-gray-700">
              <div><span className="font-medium">API URL:</span> {embedData.apiUrl}</div>
              <div><span className="font-medium">Position:</span> bottom-right (fixed)</div>
              <div><span className="font-medium">Color:</span> #3b82f6 (customizable via URL)</div>
              <div className="flex items-center gap-1 text-green-600">
                <span className="font-medium">Mobile:</span> Full-screen support ✓
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <span className="font-medium">Updates:</span> Automatic ✓
              </div>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
