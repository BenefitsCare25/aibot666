import apiClient from './client';

export const analyticsApi = {
  // Get analytics data
  getAnalytics: async (params = {}) => {
    const { startDate, endDate } = params;
    return apiClient.get('/api/admin/analytics', { params: { startDate, endDate } });
  },

  // Get recent activity
  getRecentActivity: async (params = {}) => {
    const { startDate, endDate, limit = 10 } = params;
    return apiClient.get('/api/admin/analytics/recent-activity', { params: { startDate, endDate, limit } });
  },

  // Get frequent categories
  getFrequentCategories: async (params = {}) => {
    const { startDate, endDate, categoryLimit = 5, questionLimit = 5 } = params;
    return apiClient.get('/api/admin/analytics/frequent-categories', { params: { startDate, endDate, categoryLimit, questionLimit } });
  },

  // Get query trends
  getQueryTrends: async (params = {}) => {
    const { days = 7 } = params;
    return apiClient.get('/api/admin/analytics/query-trends', { params: { days } });
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
