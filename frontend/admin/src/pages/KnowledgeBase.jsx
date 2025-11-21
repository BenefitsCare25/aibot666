import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { knowledgeApi } from '../api/knowledge';
import toast from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';

export default function KnowledgeBase() {
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = useState('entries'); // 'entries' or 'documents'

  // Knowledge entries state
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'benefits',
    subcategory: ''
  });
  const [editData, setEditData] = useState({
    title: '',
    content: '',
    category: '',
    subcategory: ''
  });
  const [savingId, setSavingId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // PDF Documents state
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [processingDocs, setProcessingDocs] = useState(new Set());
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState(null);
  const [showChunksModal, setShowChunksModal] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  useEffect(() => {
    loadEntries();
    loadDocuments();
  }, []);

  const loadEntries = async () => {
    try {
      const response = await knowledgeApi.getAll({ limit: 100 });
      setEntries(response.data.entries);
    } catch (error) {
      toast.error('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await knowledgeApi.getDocuments({ limit: 100 });
      setDocuments(response.data.data || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await knowledgeApi.create(formData);
      toast.success('Knowledge entry created!');
      setShowModal(false);
      setFormData({ title: '', content: '', category: 'benefits', subcategory: '' });
      loadEntries();
    } catch (error) {
      toast.error('Failed to create entry');
    }
  };

  const startEditing = (entry) => {
    setEditingId(entry.id);
    setEditData({
      title: entry.title || '',
      content: entry.content || '',
      category: entry.category || 'benefits',
      subcategory: entry.subcategory || ''
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({ title: '', content: '', category: '', subcategory: '' });
  };

  const saveEdit = async (id) => {
    if (!editData.title.trim() || !editData.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    setSavingId(id);
    try {
      const response = await knowledgeApi.update(id, editData);

      setEntries(entries.map(entry =>
        entry.id === id ? { ...entry, ...response.data } : entry
      ));

      setEditingId(null);
      setEditData({ title: '', content: '', category: '', subcategory: '' });
      toast.success('Entry updated successfully');
    } catch (error) {
      toast.error('Failed to update entry');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await knowledgeApi.delete(id);
      toast.success('Entry deleted');
      loadEntries();
    } catch (error) {
      toast.error('Failed to delete entry');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('Please upload a valid Excel file (.xlsx or .xls)');
        return;
      }
      setUploadFile(file);
    }
  };

  const handleUploadExcel = async () => {
    if (!uploadFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);

    try {
      const response = await knowledgeApi.uploadExcel(uploadFile, replaceExisting);
      toast.success(response.data.message || 'Excel file uploaded successfully');
      setShowUploadModal(false);
      setUploadFile(null);
      setReplaceExisting(false);
      loadEntries();
    } catch (error) {
      console.error('Error uploading Excel file:', error);
      const errorMessage = error.message || error.response?.data?.details || 'Failed to upload Excel file';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await knowledgeApi.downloadTemplate();
      toast.success('Template downloaded successfully!');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    }
  };

  // PDF Document Upload Functions
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }

    // Validate file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be less than 25MB');
      return;
    }

    setUploadingPdf(true);
    try {
      const response = await knowledgeApi.uploadDocument(file, selectedCategory || null);
      console.log('Upload response:', response); // Debug log

      // Handle different response structures
      const documentId = response.data?.data?.documentId || response.data?.documentId;

      if (!documentId) {
        console.error('No document ID in response:', response);
        throw new Error('Upload succeeded but no document ID returned');
      }

      toast.success('Document uploaded! Processing in background...');

      // Start polling for this document
      setProcessingDocs(prev => new Set(prev).add(documentId));
      pollDocumentStatus(documentId);

      // Reload documents list
      loadDocuments();
      setSelectedCategory('');
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Error response:', error.response);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to upload document';
      toast.error(errorMsg);
    } finally {
      setUploadingPdf(false);
    }
  }, [selectedCategory]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploadingPdf
  });

  // Status polling with exponential backoff
  const pollDocumentStatus = async (documentId, delay = 2000) => {
    try {
      const response = await knowledgeApi.getDocumentStatus(documentId);
      const { status } = response.data.data;

      // Update documents list
      setDocuments(prev =>
        prev.map(doc => doc.id === documentId ? response.data.data : doc)
      );

      if (status === 'completed') {
        setProcessingDocs(prev => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
        toast.success('Document processed successfully!');
        loadDocuments(); // Refresh full list
        return;
      }

      if (status === 'failed') {
        setProcessingDocs(prev => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
        toast.error('Document processing failed');
        loadDocuments();
        return;
      }

      // Continue polling with exponential backoff (max 10s)
      const nextDelay = Math.min(delay * 1.5, 10000);
      setTimeout(() => pollDocumentStatus(documentId, nextDelay), nextDelay);
    } catch (error) {
      console.error('Polling error:', error);
      // Stop polling on error
      setProcessingDocs(prev => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  };

  const handleDeleteDocument = async () => {
    if (!deleteConfirmDoc) return;

    try {
      await knowledgeApi.deleteDocument(deleteConfirmDoc.id);
      toast.success('Document and all chunks deleted successfully');
      setDeleteConfirmDoc(null);
      loadDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleViewChunks = async (documentId) => {
    setShowChunksModal(documentId);
    setChunksLoading(true);
    try {
      const response = await knowledgeApi.getDocumentChunks(documentId, { limit: 50 });
      setChunks(response.data.data || []);
    } catch (error) {
      console.error('Failed to load chunks:', error);
      toast.error('Failed to load chunks');
    } finally {
      setChunksLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      queued: { icon: '⏳', text: 'Queued', class: 'bg-yellow-100 text-yellow-800' },
      processing: { icon: '🔄', text: 'Processing', class: 'bg-blue-100 text-blue-800' },
      completed: { icon: '✅', text: 'Completed', class: 'bg-green-100 text-green-800' },
      failed: { icon: '❌', text: 'Failed', class: 'bg-red-100 text-red-800' }
    };
    const badge = badges[status] || badges.queued;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.class} flex items-center gap-1`}>
        <span>{badge.icon}</span>
        <span>{badge.text}</span>
      </span>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-600 mt-1">Manage AI training content and policies</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'entries' && (
            <>
              {can('knowledge.upload') && (
                <button
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Template
                </button>
              )}
              {can('knowledge.upload') && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Excel
                </button>
              )}
              {can('knowledge.create') && (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
                >
                  <span>➕</span>
                  Add Entry
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('entries')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'entries'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Knowledge Entries
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'documents'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            PDF Documents
          </button>
        </nav>
      </div>

      {/* Knowledge Entries Tab */}
      {activeTab === 'entries' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="grid gap-4">
              {entries.map((entry) => (
                <div key={entry.id} className="bg-white rounded-lg shadow p-6">
                  {editingId === entry.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                          type="text"
                          value={editData.title}
                          onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Entry title"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                        <textarea
                          value={editData.content}
                          onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          rows={6}
                          placeholder="Entry content"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                          <select
                            value={editData.category}
                            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="benefits">Benefits</option>
                            <option value="claims">Claims</option>
                            <option value="policies">Policies</option>
                            <option value="procedures">Procedures</option>
                            <option value="Escalations">Escalations</option>
                            <option value="hitl_learning">HITL Learning</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                          <input
                            type="text"
                            value={editData.subcategory}
                            onChange={(e) => setEditData({ ...editData, subcategory: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="e.g., dental, optical"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => saveEdit(entry.id)}
                          disabled={savingId === entry.id}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {savingId === entry.id ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={savingId === entry.id}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{entry.title}</h3>
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {entry.category}
                          </span>
                          {entry.subcategory && (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                              {entry.subcategory}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm whitespace-pre-wrap">{entry.content}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          Created: {new Date(entry.created_at).toLocaleDateString()}
                          {entry.updated_at && entry.updated_at !== entry.created_at && (
                            <> • Updated: {new Date(entry.updated_at).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {can('knowledge.edit') && (
                          <button
                            onClick={() => startEditing(entry)}
                            className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded font-medium"
                          >
                            Edit
                          </button>
                        )}
                        {can('knowledge.delete') && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded font-medium"
                          >
                            Delete
                          </button>
                        )}
                        {!can('knowledge.edit') && !can('knowledge.delete') && (
                          <span className="text-gray-400 text-sm">No actions available</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PDF Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Upload Section */}
          {can('knowledge.upload') && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Upload PDF Document</h2>

              {/* Category Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category (Optional)
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Auto-detect category</option>
                  <option value="benefits">Benefits</option>
                  <option value="claims">Claims</option>
                  <option value="policies">Policies</option>
                  <option value="procedures">Procedures</option>
                  <option value="HR Guidelines">HR Guidelines</option>
                  <option value="Training">Training</option>
                </select>
              </div>

              {/* Drag & Drop Zone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary-500 bg-primary-50'
                    : uploadingPdf
                    ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="space-y-2">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {uploadingPdf ? (
                    <p className="text-sm text-gray-600">Uploading PDF...</p>
                  ) : isDragActive ? (
                    <p className="text-sm text-primary-600 font-medium">Drop PDF here...</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-primary-600">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PDF only, max 25MB</p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">How it works:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• PDF is processed in the background (30-60 seconds)</li>
                  <li>• Text is extracted and chunked intelligently</li>
                  <li>• Category is auto-detected using AI</li>
                  <li>• Embeddings are generated for semantic search</li>
                  <li>• All chunks become searchable by the chatbot</li>
                </ul>
              </div>
            </div>
          )}

          {/* Documents List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Uploaded Documents</h2>
            </div>

            {documentsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Filename
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pages
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chunks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uploaded
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(doc.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{doc.original_name}</div>
                          {doc.error_message && (
                            <div className="text-xs text-red-600 mt-1">{doc.error_message}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {doc.category ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                              {doc.category}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {doc.page_count || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {doc.chunk_count || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {doc.status === 'completed' && (
                              <button
                                onClick={() => handleViewChunks(doc.id)}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                View Chunks
                              </button>
                            )}
                            {can('knowledge.delete') && (
                              <button
                                onClick={() => setDeleteConfirmDoc(doc)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Excel Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Upload Knowledge Base Excel</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Excel File (.xlsx or .xls)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {uploadFile && (
                  <p className="text-sm text-green-600 mt-2">
                    Selected: {uploadFile.name}
                  </p>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="replace-existing"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="replace-existing" className="ml-2 text-sm text-gray-700">
                  Replace all existing entries
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-1">Excel Format:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Column A: Title (required)</li>
                  <li>• Column B: Content (required)</li>
                  <li>• Column C: Category (optional, defaults to 'general')</li>
                  <li>• Column D: Subcategory (optional)</li>
                  <li>• First row is treated as header and skipped</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUploadExcel}
                  disabled={uploading || !uploadFile}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    uploading || !uploadFile
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading...
                    </span>
                  ) : (
                    'Upload & Import'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setReplaceExisting(false);
                  }}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Add Knowledge Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={6}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="benefits">Benefits</option>
                    <option value="claims">Claims</option>
                    <option value="policies">Policies</option>
                    <option value="procedures">Procedures</option>
                    <option value="Escalations">Escalations</option>
                    <option value="hitl_learning">HITL Learning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., dental, optical"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Create Entry
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-red-600">Delete Document</h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete <strong>{deleteConfirmDoc.original_name}</strong>?
            </p>
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-4">
              <p className="text-sm text-red-800">
                This will permanently delete:
              </p>
              <ul className="text-sm text-red-800 mt-2 space-y-1">
                <li>• The document record</li>
                <li>• All {deleteConfirmDoc.chunk_count || 0} knowledge chunks</li>
                <li>• All embeddings and metadata</li>
              </ul>
              <p className="text-sm text-red-800 font-semibold mt-2">This action cannot be undone!</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteDocument}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Document
              </button>
              <button
                onClick={() => setDeleteConfirmDoc(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Chunks Modal */}
      {showChunksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Document Chunks</h2>
              <button
                onClick={() => {
                  setShowChunksModal(null);
                  setChunks([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {chunksLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : chunks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No chunks found</p>
            ) : (
              <div className="space-y-4">
                {chunks.map((chunk, index) => (
                  <div key={chunk.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700">
                        Chunk {index + 1}
                      </span>
                      {chunk.category && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {chunk.category}
                        </span>
                      )}
                      {chunk.subcategory && (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                          {chunk.subcategory}
                        </span>
                      )}
                    </div>
                    {chunk.title && (
                      <h4 className="font-medium text-gray-900 mb-2">{chunk.title}</h4>
                    )}
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{chunk.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
