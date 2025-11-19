import apiClient from './client';

export const knowledgeApi = {
  // Get all knowledge entries
  getAll: async (params = {}) => {
    const { page = 1, limit = 50, category = '', search = '' } = params;
    return apiClient.get('/api/admin/knowledge', { params: { page, limit, category, search } });
  },

  // Create knowledge entry
  create: async (data) => {
    return apiClient.post('/api/admin/knowledge', data);
  },

  // Create multiple entries
  createBatch: async (entries) => {
    return apiClient.post('/api/admin/knowledge/batch', { entries });
  },

  // Update knowledge entry
  update: async (id, data) => {
    return apiClient.put(`/api/admin/knowledge/${id}`, data);
  },

  // Delete knowledge entry
  delete: async (id) => {
    return apiClient.delete(`/api/admin/knowledge/${id}`);
  },

  // Upload Excel file
  uploadExcel: async (file, replace = false) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('replace', replace.toString());

    return apiClient.post('/api/admin/knowledge/upload-excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Download Excel template
  downloadTemplate: async () => {
    const axios = (await import('axios')).default;
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/knowledge/download-template`,
      {
        responseType: 'blob',
        headers: {
          'Authorization': localStorage.getItem('adminToken') ? `Bearer ${localStorage.getItem('adminToken')}` : '',
          'X-Widget-Domain': localStorage.getItem('selected_company_domain') || ''
        }
      }
    );

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'KnowledgeBase_Template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
