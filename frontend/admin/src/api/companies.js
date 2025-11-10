import apiClient from './client';

export const companyApi = {
  // Get all companies
  getAll: async () => {
    return apiClient.get('/api/admin/companies');
  },

  // Get company by ID
  getById: async (id) => {
    return apiClient.get(`/api/admin/companies/${id}`);
  },

  // Create new company
  create: async (companyData) => {
    return apiClient.post('/api/admin/companies', companyData);
  },

  // Update company
  update: async (id, companyData) => {
    return apiClient.put(`/api/admin/companies/${id}`, companyData);
  },

  // Delete company (soft delete by default)
  delete: async (id, permanent = false) => {
    const url = permanent
      ? `/api/admin/companies/${id}?permanent=true`
      : `/api/admin/companies/${id}`;
    return apiClient.delete(url);
  },

  // Update company status
  updateStatus: async (id, status) => {
    return apiClient.patch(`/api/admin/companies/${id}/status`, { status });
  },

  // Get embed code for company
  getEmbedCode: async (id) => {
    return apiClient.get(`/api/admin/companies/${id}/embed-code`);
  }
};
