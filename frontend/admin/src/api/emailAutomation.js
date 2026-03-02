import apiClient from './client';

const BASE = '/api/admin/email-automation';

export const emailAutomationApi = {
  getAll: () => apiClient.get(BASE),
  create: (data) => apiClient.post(BASE, data),
  update: (id, data) => apiClient.put(`${BASE}/${id}`, data),
  remove: (id) => apiClient.delete(`${BASE}/${id}`),
  sendNow: (id) => apiClient.post(`${BASE}/${id}/send`),
  importExcel: (formData) => apiClient.post(`${BASE}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};
