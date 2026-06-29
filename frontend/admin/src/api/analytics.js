import apiClient, { downloadFile } from './client';

export const analyticsApi = {
  // Download HR Excel report of question insights
  downloadQualityReport: async (params = {}) => {
    const { startDate, endDate } = params;
    const query = new URLSearchParams();
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const stamp = new Date().toISOString().split('T')[0];
    await downloadFile(
      `/api/admin/analytics/quality-report${suffix}`,
      `Chatbot_Question_Insights_${stamp}.xlsx`
    );
  },

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
    const { days, startDate, endDate } = params;
    return apiClient.get('/api/admin/analytics/query-trends', {
      params: { days, startDate, endDate }
    });
  },

  getQualityAnalytics: async (params = {}) => {
    const { startDate, endDate } = params;
    return apiClient.get('/api/admin/analytics/quality', {
      params: { startDate, endDate }
    });
  },

  getSystemHealth: async () => {
    return apiClient.get('/api/admin/analytics/health');
  },

  // Reset knowledge base usage counts
  resetUsageCounts: async () => {
    return apiClient.post('/api/admin/analytics/reset-usage');
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
