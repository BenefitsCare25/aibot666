import apiClient from './client';

export const quickQuestionsApi = {
  // Get all active quick questions grouped by category (for widget)
  getActive: async () => {
    return apiClient.get('/api/admin/quick-questions');
  },

  // Get all quick questions (admin view with inactive)
  getAll: async () => {
    return apiClient.get('/api/admin/quick-questions/all');
  },

  // Create new quick question
  create: async (questionData) => {
    return apiClient.post('/api/admin/quick-questions', questionData);
  },

  // Update quick question
  update: async (id, questionData) => {
    return apiClient.put(`/api/admin/quick-questions/${id}`, questionData);
  },

  // Delete quick question
  delete: async (id) => {
    return apiClient.delete(`/api/admin/quick-questions/${id}`);
  },

  // Bulk import quick questions
  bulkImport: async (questions, replace = false) => {
    return apiClient.post('/api/admin/quick-questions/bulk-import', { questions, replace });
  },

  // Upload Excel file
  uploadExcel: async (file, replace = false) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('replace', replace.toString());

    return apiClient.post('/api/admin/quick-questions/upload-excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Update category name and icon for all questions in a category
  updateCategory: async (categoryId, categoryData) => {
    return apiClient.put(`/api/admin/quick-questions/category/${categoryId}`, categoryData);
  },

  // Download Excel template
  downloadTemplate: async () => {
    const axios = (await import('axios')).default;
    const response = await axios.get(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/quick-questions/download-template`,
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
    a.download = 'QuickQuestions_Template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
