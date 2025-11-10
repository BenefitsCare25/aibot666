import apiClient from './client';

export const employeeApi = {
  // Get all employees with pagination and search
  getAll: async (params = {}) => {
    const { page = 1, limit = 50, search = '' } = params;
    return apiClient.get('/api/admin/employees', { params: { page, limit, search } });
  },

  // Get employee by ID
  getById: async (id) => {
    return apiClient.get(`/api/admin/employees/${id}`);
  },

  // Add single employee
  create: async (employeeData) => {
    return apiClient.post('/api/admin/employees', employeeData);
  },

  // Update employee
  update: async (id, employeeData) => {
    return apiClient.put(`/api/admin/employees/${id}`, employeeData);
  },

  // Delete employee
  delete: async (id) => {
    return apiClient.delete(`/api/admin/employees/${id}`);
  },

  // Bulk delete employees
  bulkDelete: async (employeeIds) => {
    return apiClient.post('/api/admin/employees/bulk-delete', { employeeIds });
  },

  // Get all employee IDs (with optional search filter)
  getAllIds: async (params = {}) => {
    const { search = '' } = params;
    return apiClient.get('/api/admin/employees/ids', { params: { search } });
  },

  // Upload employees via Excel
  uploadExcel: async (file, duplicateAction = 'skip', onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('duplicateAction', duplicateAction);

    return apiClient.post('/api/admin/employees/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 600000, // 10 minutes for large uploads with batching
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
  },

  // Download Excel template
  downloadTemplate: async () => {
    // Use axios directly to bypass response interceptor that unwraps response.data
    const axios = (await import('axios')).default;
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/employees/template`,
      {
        responseType: 'blob',
        headers: {
          'Authorization': localStorage.getItem('admin_token') ? `Bearer ${localStorage.getItem('admin_token')}` : '',
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
    a.download = 'employee_template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
