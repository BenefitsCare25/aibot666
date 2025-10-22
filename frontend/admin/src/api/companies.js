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

  // Delete company
  delete: async (id) => {
    return apiClient.delete(`/api/admin/companies/${id}`);
  }
};
