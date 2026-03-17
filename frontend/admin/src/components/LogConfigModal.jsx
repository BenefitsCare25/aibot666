import { useState, useEffect } from 'react';
import { companyApi } from '../api/companies';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

function generateRouteId(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `route-${Date.now()}`;
}

export default function LogConfigModal({ company, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [routes, setRoutes] = useState([]);
  const [downloadableFiles, setDownloadableFiles] = useState({});

  useEffect(() => {
    if (company) {
      const logConfig = company.settings?.logConfig || {};
      setRoutes(logConfig.routes || []);
      setDownloadableFiles(logConfig.downloadableFiles || {});
    }
  }, [company]);

  const handleSave = async () => {
    setError('');
    setLoading(true);

    try {
      const existingSettings = company.settings || {};
      const updatedSettings = {
        ...existingSettings,
        logConfig: routes.length > 0 ? { routes, downloadableFiles } : undefined
      };

      // Remove logConfig key entirely if no routes
      if (!updatedSettings.logConfig) {
        delete updatedSettings.logConfig;
      }

      await companyApi.update(company.id, {
        name: company.name,
        domain: company.domain,
        additional_domains: company.additional_domains || [],
        schema_name: company.schema_name,
        status: company.status,
        settings: updatedSettings
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error saving LOG config:', err);
      setError(err.response?.data?.error || 'Failed to save LOG configuration');
    } finally {
      setLoading(false);
    }
  };

  // Route management
  const addRoute = () => {
    setRoutes([...routes, {
      id: `route-${Date.now()}`,
      label: '',
      requiredDocuments: []
    }]);
  };

  const updateRoute = (index, field, value) => {
    const updated = [...routes];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'label') {
      updated[index].id = generateRouteId(value);
    }
    setRoutes(updated);
  };

  const removeRoute = (index) => {
    setRoutes(routes.filter((_, i) => i !== index));
  };

  const moveRoute = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= routes.length) return;
    const updated = [...routes];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setRoutes(updated);
  };

  // Document management per route
  const addDocument = (routeIndex) => {
    const updated = [...routes];
    updated[routeIndex].requiredDocuments = [
      ...(updated[routeIndex].requiredDocuments || []),
      { name: '', description: '', downloadKey: null }
    ];
    setRoutes(updated);
  };

  const updateDocument = (routeIndex, docIndex, field, value) => {
    const updated = [...routes];
    updated[routeIndex].requiredDocuments[docIndex] = {
      ...updated[routeIndex].requiredDocuments[docIndex],
      [field]: value
    };
    setRoutes(updated);
  };

  const removeDocument = (routeIndex, docIndex) => {
    const updated = [...routes];
    updated[routeIndex].requiredDocuments = updated[routeIndex].requiredDocuments.filter((_, i) => i !== docIndex);
    setRoutes(updated);
  };

  // File upload
  const handleFileUpload = async (e, downloadKey) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError(`File "${file.name}" is too large. Maximum size is 2MB.`);
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }

    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setDownloadableFiles(prev => ({
        ...prev,
        [downloadKey]: {
          fileName: file.name,
          base64,
          mimeType: file.type,
          size: file.size
        }
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const removeFile = (downloadKey) => {
    const updated = { ...downloadableFiles };
    delete updated[downloadKey];
    setDownloadableFiles(updated);

    // Clear downloadKey from any documents referencing it
    setRoutes(routes.map(route => ({
      ...route,
      requiredDocuments: route.requiredDocuments.map(doc =>
        doc.downloadKey === downloadKey ? { ...doc, downloadKey: null } : doc
      )
    })));
  };

  // Get all unique downloadKeys in use
  const usedDownloadKeys = new Set();
  routes.forEach(route => {
    route.requiredDocuments?.forEach(doc => {
      if (doc.downloadKey) usedDownloadKeys.add(doc.downloadKey);
    });
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-4 border-b z-10">
          <h2 className="text-xl font-bold text-gray-900">
            LOG Configuration - {company?.name}
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

        <div className="space-y-6">
          {/* Routes Section */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Hospital Type Routes</h3>
              <button
                type="button"
                onClick={addRoute}
                className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                + Add Route
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Define hospital type options users can choose from when submitting a LOG request.
              Companies with no routes will show the default LOG form.
            </p>

            {routes.length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500 text-sm">No routes configured. Users will see the default LOG form.</p>
                <button
                  type="button"
                  onClick={addRoute}
                  className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add first route
                </button>
              </div>
            )}

            {routes.map((route, routeIndex) => (
              <div
                key={route.id || routeIndex}
                className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveRoute(routeIndex, -1)}
                      disabled={routeIndex === 0}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRoute(routeIndex, 1)}
                      disabled={routeIndex === routes.length - 1}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      value={route.label}
                      onChange={(e) => updateRoute(routeIndex, 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      placeholder="e.g. Govt / Restructured Hospital"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRoute(routeIndex)}
                    className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                    title="Remove route"
                  >
                    ✕
                  </button>
                </div>

                {route.label && (
                  <p className="text-xs text-gray-500 mb-3">
                    ID: <code className="bg-gray-200 px-1 rounded">{route.id}</code>
                  </p>
                )}

                {/* Required Documents */}
                <div className="ml-6">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-gray-700">Required Documents</p>
                    <button
                      type="button"
                      onClick={() => addDocument(routeIndex)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      + Add document
                    </button>
                  </div>

                  {(!route.requiredDocuments || route.requiredDocuments.length === 0) && (
                    <p className="text-xs text-gray-400 italic">No documents listed</p>
                  )}

                  {route.requiredDocuments?.map((doc, docIndex) => (
                    <div key={docIndex} className="flex items-start gap-2 mb-2 bg-white rounded-lg p-2 border border-gray-100">
                      <div className="flex-1 space-y-1.5">
                        <input
                          type="text"
                          value={doc.name}
                          onChange={(e) => updateDocument(routeIndex, docIndex, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary-500"
                          placeholder="Document name"
                        />
                        <input
                          type="text"
                          value={doc.description || ''}
                          onChange={(e) => updateDocument(routeIndex, docIndex, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-primary-500"
                          placeholder="Description (optional)"
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!doc.downloadKey}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateDocument(routeIndex, docIndex, 'downloadKey', 'log-form');
                                } else {
                                  updateDocument(routeIndex, docIndex, 'downloadKey', null);
                                }
                              }}
                              className="w-3.5 h-3.5 rounded border-gray-300"
                            />
                            Downloadable
                          </label>
                          {doc.downloadKey && (
                            <input
                              type="text"
                              value={doc.downloadKey}
                              onChange={(e) => updateDocument(routeIndex, docIndex, 'downloadKey', e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-primary-500"
                              placeholder="Download key (e.g. log-form)"
                            />
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDocument(routeIndex, docIndex)}
                        className="text-red-400 hover:text-red-600 text-xs mt-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Downloadable Files Section */}
          {usedDownloadKeys.size > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Downloadable Files</h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload PDF files for documents marked as downloadable above. Files are stored as base64 in company settings.
              </p>

              {Array.from(usedDownloadKeys).map((key) => (
                <div key={key} className="border border-gray-200 rounded-lg p-3 mb-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      Key: <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">{key}</code>
                    </p>
                    {downloadableFiles[key] && (
                      <button
                        type="button"
                        onClick={() => removeFile(key)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove file
                      </button>
                    )}
                  </div>

                  {downloadableFiles[key] ? (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
                      <span>✓</span>
                      <span>{downloadableFiles[key].fileName}</span>
                      <span className="text-xs text-green-600">
                        ({(downloadableFiles[key].size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                  ) : (
                    <div>
                      <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                        <span className="text-sm text-gray-500">Click to upload PDF</span>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => handleFileUpload(e, key)}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-gray-400 mt-1">Max 2MB. PDF only.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">How LOG Routes Work:</p>
                <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>No routes:</strong> Users see the default LOG request form</li>
                  <li><strong>1 route:</strong> Auto-selected, documents shown above the form</li>
                  <li><strong>2+ routes:</strong> Users choose hospital type first, then see form</li>
                  <li><strong>Download key:</strong> Links a document to an uploaded PDF file</li>
                  <li>Multiple routes can share the same download key (same file)</li>
                  <li>The route label is included in the support email notification</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors mt-4"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
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
      </div>
    </div>
  );
}
