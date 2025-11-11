import { useState, useEffect } from 'react';
import { companyApi } from '../api/companies';
import EmbedCodeModal from '../components/EmbedCodeModal';
import EmailConfigModal from '../components/EmailConfigModal';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [showEmbedCode, setShowEmbedCode] = useState(null);
  const [showEmailConfig, setShowEmailConfig] = useState(null);
  const [creatingSchema, setCreatingSchema] = useState(false); // New state for schema creation
  const [successMessage, setSuccessMessage] = useState(''); // New state for success messages
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    additional_domains: '',
    schema_name: '',
    status: 'active',
    settings: '{}'
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const response = await companyApi.getAll();
      setCompanies(response.data || []);
      setError('');
    } catch (err) {
      console.error('Error loading companies:', err);
      setError('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      const submitData = {
        ...formData,
        additional_domains: formData.additional_domains
          ? formData.additional_domains.split(',').map(d => d.trim()).filter(Boolean)
          : [],
        settings: formData.settings ? JSON.parse(formData.settings) : {}
      };

      if (editingCompany) {
        await companyApi.update(editingCompany.id, submitData);
        setSuccessMessage('Company updated successfully');
      } else {
        // Creating new company - show schema creation loading state
        setCreatingSchema(true);
        const response = await companyApi.create(submitData);

        // Check if schema was created
        if (response.data.schema?.created) {
          setSuccessMessage(
            `Company created successfully! Database schema "${response.data.schema.name}" created in ${response.data.schema.duration}ms`
          );
        } else {
          setSuccessMessage('Company created successfully');
        }
      }

      setShowForm(false);
      setEditingCompany(null);
      resetForm();
      loadCompanies();

      // Dispatch event to refresh company selector
      window.dispatchEvent(new Event('company-changed'));

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error saving company:', err);
      const errorMessage = err.response?.data?.details || err.response?.data?.error || 'Failed to save company';
      const errorNote = err.response?.data?.note || '';
      setError(errorNote ? `${errorMessage}. ${errorNote}` : errorMessage);
    } finally {
      setCreatingSchema(false);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      domain: company.domain,
      additional_domains: company.additional_domains?.join(', ') || '',
      schema_name: company.schema_name,
      status: company.status || 'active',
      settings: JSON.stringify(company.settings || {}, null, 2)
    });
    setShowForm(true);
  };

  const handleDelete = async (id, companyName) => {
    // Confirm permanent deletion
    const confirmMessage = `⚠️ PERMANENT DELETION WARNING ⚠️\n\n` +
      `You are about to PERMANENTLY DELETE:\n` +
      `Company: ${companyName}\n\n` +
      `This will:\n` +
      `• Delete the entire database schema and ALL data\n` +
      `• Remove the company from the registry\n` +
      `• This action CANNOT be undone\n\n` +
      `Type "DELETE" to confirm permanent deletion:`;

    const userInput = window.prompt(confirmMessage);

    if (userInput !== 'DELETE') {
      if (userInput !== null) {
        setError('Deletion cancelled. You must type "DELETE" exactly to confirm.');
      }
      return;
    }

    try {
      setSuccessMessage('');
      setError('');

      // Perform hard delete with permanent=true
      const response = await companyApi.delete(id, true);
      setSuccessMessage(response.data.message || 'Company permanently deleted');
      loadCompanies();

      // Dispatch event to refresh company selector
      window.dispatchEvent(new Event('company-changed'));

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error deleting company:', err);
      setError(err.response?.data?.details || 'Failed to delete company');
    }
  };

  const handleStatusToggle = async (id, currentStatus) => {
    // Determine next status in cycle: active -> inactive -> suspended -> active
    const statusCycle = {
      'active': 'inactive',
      'inactive': 'suspended',
      'suspended': 'active'
    };

    const newStatus = statusCycle[currentStatus] || 'active';

    try {
      setSuccessMessage('');
      setError('');

      const response = await companyApi.updateStatus(id, newStatus);
      setSuccessMessage(`Company status updated to ${newStatus}`);
      loadCompanies();

      // Dispatch event to refresh company selector
      window.dispatchEvent(new Event('company-changed'));

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating status:', err);
      setError(err.response?.data?.details || 'Failed to update company status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      domain: '',
      additional_domains: '',
      schema_name: '',
      status: 'active',
      settings: '{}'
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCompany(null);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading companies...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
          <p className="text-gray-600 mt-1">Manage multi-tenant company configurations</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Add Company
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Company Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingCompany ? 'Edit Company' : 'Add New Company'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Company A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Domain *
                </label>
                <input
                  type="text"
                  required
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="company-a.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Domain without protocol (e.g., company-a.com)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Domains
                </label>
                <input
                  type="text"
                  value={formData.additional_domains}
                  onChange={(e) => setFormData({ ...formData, additional_domains: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="www.company-a.com, app.company-a.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated list of alternative domains
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schema Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.schema_name}
                  onChange={(e) => setFormData({ ...formData, schema_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="company_a"
                  disabled={!!editingCompany}
                />
                <p className="text-xs text-gray-500 mt-1">
                  PostgreSQL schema name (cannot be changed after creation)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Settings (JSON)
                </label>
                <textarea
                  value={formData.settings}
                  onChange={(e) => setFormData({ ...formData, settings: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                  rows={4}
                  placeholder='{"theme": "blue", "features": []}'
                />
                <p className="text-xs text-gray-500 mt-1">
                  Valid JSON object for company-specific settings
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={creatingSchema}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    creatingSchema
                      ? 'bg-primary-400 text-white cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {creatingSchema ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating schema...
                    </span>
                  ) : (
                    editingCompany ? 'Update Company' : 'Create Company'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={creatingSchema}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    creatingSchema
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Companies Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Schema
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {companies.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No companies found. Add your first company to get started.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{company.name}</div>
                    {company.additional_domains?.length > 0 && (
                      <div className="text-xs text-gray-500">
                        +{company.additional_domains.length} more domains
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{company.domain}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {company.schema_name}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        company.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : company.status === 'suspended'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {company.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(company.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setShowEmbedCode(company)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="View embed code"
                    >
                      &lt;/&gt;
                    </button>
                    <button
                      onClick={() => setShowEmailConfig(company)}
                      className="text-purple-600 hover:text-purple-900 mr-3"
                      title="Configure email settings"
                    >
                      📧
                    </button>
                    <button
                      onClick={() => handleStatusToggle(company.id, company.status)}
                      className={`mr-3 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        company.status === 'active'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : company.status === 'suspended'
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                      title="Click to toggle status"
                    >
                      Status
                    </button>
                    <button
                      onClick={() => handleEdit(company)}
                      className="text-primary-600 hover:text-primary-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(company.id, company.name)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Total Companies</h3>
          <p className="text-3xl font-bold text-blue-700">{companies.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-900 mb-2">Active Companies</h3>
          <p className="text-3xl font-bold text-green-700">
            {companies.filter((c) => c.status === 'active').length}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Inactive Companies</h3>
          <p className="text-3xl font-bold text-gray-700">
            {companies.filter((c) => c.status !== 'active').length}
          </p>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">ℹ️ Company Management</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li><strong>Automatic Schema Creation:</strong> Database schemas are created automatically when you add a new company</li>
          <li><strong>Schema Name:</strong> Cannot be changed after company creation</li>
          <li><strong>Status Toggle:</strong> Click the "Status" button to cycle between Active → Inactive → Suspended → Active</li>
          <li><strong>Permanent Delete:</strong> Delete button permanently removes the company, schema, and ALL data (requires typing "DELETE" to confirm)</li>
          <li><strong>Status Management:</strong> Use status toggle to temporarily deactivate companies without losing data</li>
          <li><strong>Domain Normalization:</strong> Protocol, www, and port are removed automatically</li>
          <li><strong>Schema Template:</strong> All schemas use the template in <code>backend/config/company-schema-template.sql</code></li>
        </ul>
      </div>

      {/* Email Configuration Modal */}
      {showEmailConfig && (
        <EmailConfigModal
          company={showEmailConfig}
          onClose={() => setShowEmailConfig(null)}
          onSuccess={() => {
            loadCompanies();
            setSuccessMessage('Email configuration updated successfully');
            setTimeout(() => setSuccessMessage(''), 5000);
          }}
        />
      )}

      {/* Embed Code Modal */}
      {showEmbedCode && (
        <EmbedCodeModal
          company={showEmbedCode}
          onClose={() => setShowEmbedCode(null)}
        />
      )}
    </div>
  );
}
