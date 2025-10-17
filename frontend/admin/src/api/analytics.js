import apiClient from './client';

export const analyticsApi = {
  // Get analytics data
  getAnalytics: async (params = {}) => {
    const { startDate, endDate } = params;
    return apiClient.get('/api/admin/analytics', { params: { startDate, endDate } });
  },

  // Get escalations
  getEscalations: async (params = {}) => {
    const { status = '', page = 1, limit = 50 } = params;
    return apiClient.get('/api/admin/escalations', { params: { status, page, limit } });
  },

  // Update escalation
  updateEscalation: async (id, updates) => {
    return apiClient.patch(`/api/admin/escalations/${id}`, updates);
  }
};
