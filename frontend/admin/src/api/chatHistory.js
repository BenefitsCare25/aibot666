import apiClient from './client';

export const chatHistoryApi = {
  /**
   * Get all conversations with filters
   */
  getConversations: async (params = {}) => {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.escalatedOnly) queryParams.append('escalatedOnly', params.escalatedOnly);
    if (params.employeeId) queryParams.append('employeeId', params.employeeId);

    return apiClient.get(`/api/admin/chat-history?${queryParams.toString()}`);
  },

  /**
   * Get all messages for a specific conversation
   */
  getConversationMessages: async (conversationId) => {
    return apiClient.get(`/api/admin/chat-history/${conversationId}/messages`);
  },

  /**
   * Export conversation to CSV
   */
  exportConversation: async (conversationId) => {
    const response = await chatHistoryApi.getConversationMessages(conversationId);

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch conversation data');
    }

    const { messages, employee } = response.data;

    // Create CSV content
    const headers = ['Timestamp', 'Role', 'Content', 'Confidence Score', 'Escalated'];
    const rows = messages.map(msg => [
      new Date(msg.created_at).toLocaleString(),
      msg.role,
      msg.content.replace(/"/g, '""'), // Escape quotes
      msg.confidence_score || 'N/A',
      msg.was_escalated ? 'Yes' : 'No'
    ]);

    const csvContent = [
      `Conversation Export - ${employee?.name || 'Unknown Employee'}`,
      `Employee Email: ${employee?.email || 'N/A'}`,
      `Policy Type: ${employee?.policy_type || 'N/A'}`,
      `Conversation ID: ${conversationId}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `conversation_${conversationId}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return { success: true };
  }
};
