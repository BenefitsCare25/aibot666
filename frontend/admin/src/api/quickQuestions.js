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
  }
};
