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
    const { downloadFile } = await import('./client.js');
    await downloadFile('/api/admin/knowledge/download-template', 'KnowledgeBase_Template.xlsx');
  },

  // Document upload methods
  uploadDocument: async (file, category = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (category) {
      formData.append('category', category);
    }

    return apiClient.post('/api/admin/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Get all uploaded documents
  getDocuments: async (params = {}) => {
    const { page = 1, limit = 50, status = '' } = params;
    return apiClient.get('/api/admin/documents', { params: { page, limit, status } });
  },

  // Get document status (for polling)
  getDocumentStatus: async (documentId) => {
    return apiClient.get(`/api/admin/documents/${documentId}/status`);
  },

  // Delete document and all chunks
  deleteDocument: async (documentId) => {
    return apiClient.delete(`/api/admin/documents/${documentId}`);
  },

  // Get chunks from a document
  getDocumentChunks: async (documentId, params = {}) => {
    const { page = 1, limit = 20 } = params;
    return apiClient.get(`/api/admin/documents/${documentId}/chunks`, { params: { page, limit } });
  }
};
