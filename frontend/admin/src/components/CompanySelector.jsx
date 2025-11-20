import { useState, useEffect } from 'react';
import { companyApi } from '../api/companies';

export default function CompanySelector() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCompanies();
    // Load previously selected company from localStorage
    const saved = localStorage.getItem('selected_company_domain');
    if (saved) {
      setSelectedCompany(saved);
    }

    // Listen for company changes (create/update/delete)
    const handleCompanyChange = () => {
      loadCompanies();
    };

    window.addEventListener('company-changed', handleCompanyChange);

    return () => {
      window.removeEventListener('company-changed', handleCompanyChange);
    };
  }, []);

  const loadCompanies = async () => {
    try {
      setIsLoading(true);
      const response = await companyApi.getAll();
      if (response.success) {
        setCompanies(response.data);
        // Auto-select first company if none selected (but don't reload)
        const saved = localStorage.getItem('selected_company_domain');

        // Check if saved domain still exists in the company list
        const savedCompanyExists = saved && response.data.some(c => c.domain === saved);

        if (!saved && response.data.length > 0) {
          // No saved selection, auto-select first company
          const firstDomain = response.data[0].domain;
          setSelectedCompany(firstDomain);
          localStorage.setItem('selected_company_domain', firstDomain);
        } else if (saved && !savedCompanyExists && response.data.length > 0) {
          // Saved domain no longer exists, clear it and select first company
          console.warn(`[CompanySelector] Saved domain "${saved}" no longer exists. Selecting first available company.`);
          const firstDomain = response.data[0].domain;
          setSelectedCompany(firstDomain);
          localStorage.setItem('selected_company_domain', firstDomain);
          // Reload to apply new company context
          window.location.reload();
        }
      }
    } catch (err) {
      setError('Failed to load companies');
      console.error('Error loading companies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyChange = (domain) => {
    setSelectedCompany(domain);
    localStorage.setItem('selected_company_domain', domain);
    // Reload the page to apply the new company context
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
        Loading companies...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        {error}
      </div>
    );
  }

  const currentCompany = companies.find(c => c.domain === selectedCompany);

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="company-select" className="text-sm font-medium text-gray-700">
        Company:
      </label>
      <select
        id="company-select"
        value={selectedCompany}
        onChange={(e) => handleCompanyChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
      >
        {companies.map((company) => (
          <option key={company.id} value={company.domain}>
            {company.name} ({company.domain})
          </option>
        ))}
      </select>
      {currentCompany && (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
          {currentCompany.schema_name}
        </span>
      )}
    </div>
  );
}
