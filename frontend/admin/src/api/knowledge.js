import apiClient from './client';

export const knowledgeApi = {
  // Get all knowledge entries
  getAll: async (params = {}) => {
    const { page = 1, limit = 50, category = '', search = '', created_date = '' } = params;
    return apiClient.get('/api/admin/knowledge', { params: { page, limit, category, search, created_date } });
  },

  // Get filter options (categories and dates)
  getFilters: async () => {
    return apiClient.get('/api/admin/knowledge/filters');
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

  // Upload single document (PDF, DOCX, TXT, CSV)
  uploadDocument: async (file, category = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (category) {
      formData.append('category', category);
    }

    return apiClient.post('/api/admin/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Upload multiple documents at once
  uploadDocumentsBulk: async (files, category = null) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (category) {
      formData.append('category', category);
    }

    return apiClient.post('/api/admin/documents/upload-bulk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Get all uploaded documents
  getDocuments: async (params = {}) => {
    const { page = 1, limit = 50, status = '' } = params;
    return apiClient.get('/api/admin/documents', { params: { page, limit, status } });
  },

  // Get document status (for polling) — now includes step info
  getDocumentStatus: async (documentId) => {
    return apiClient.get(`/api/admin/documents/${documentId}/status`);
  },

  // Update document category/subcategory after upload
  updateDocumentMetadata: async (documentId, { category, subcategory }) => {
    return apiClient.patch(`/api/admin/documents/${documentId}/metadata`, { category, subcategory });
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
