import { useState, useEffect } from 'react';
import { companyApi } from '../api/companies';

export default function EmbedCodeModal({ company, onClose }) {
  const [embedData, setEmbedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedType, setCopiedType] = useState(null);
  const [activeTab, setActiveTab] = useState('auto');

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

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
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

        {/* Live Preview */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <span>👁️</span> Live Preview
          </h3>
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] relative">
            <div className="text-center text-gray-500">
              <p className="mb-2">Widget will appear in the bottom-right corner</p>
              <p className="text-sm">
                The chatbot widget loads on your website and allows users to interact with your AI assistant
              </p>
            </div>
            {/* Preview button indicator */}
            <div className="absolute bottom-4 right-4 bg-primary-600 text-white rounded-full p-4 shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('auto')}
              className={`pb-2 px-1 font-medium transition-colors ${
                activeTab === 'auto'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Auto-Initialize (Recommended)
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`pb-2 px-1 font-medium transition-colors ${
                activeTab === 'manual'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Manual Initialize
            </button>
          </div>
        </div>

        {/* Code Display */}
        <div className="mb-6">
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono">
              <code>
                {activeTab === 'auto' ? embedData.embedCode.autoInit : embedData.embedCode.manualInit}
              </code>
            </pre>
            <button
              onClick={() => copyToClipboard(
                activeTab === 'auto' ? embedData.embedCode.autoInit : embedData.embedCode.manualInit,
                activeTab
              )}
              className={`absolute top-3 right-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                copiedType === activeTab
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              }`}
            >
              {copiedType === activeTab ? '✓ Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <span>📋</span> Implementation Instructions
          </h3>
          <div className="text-sm text-blue-800 space-y-2 whitespace-pre-line">
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
            <h4 className="font-medium text-gray-900 mb-2">Widget Configuration</h4>
            <div className="space-y-1 text-sm text-gray-700">
              <div><span className="font-medium">API URL:</span> {embedData.apiUrl}</div>
              <div><span className="font-medium">Position:</span> bottom-right</div>
              <div><span className="font-medium">Color:</span> #3b82f6 (customizable)</div>
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
