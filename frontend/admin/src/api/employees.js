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

  // Upload employees via Excel
  uploadExcel: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post('/api/admin/employees/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
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
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/employees/template`
    );
    const blob = await response.blob();
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
