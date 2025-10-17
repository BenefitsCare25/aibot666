import { useState, useEffect } from 'react';
import { knowledgeApi } from '../api/knowledge';
import toast from 'react-hot-toast';

export default function KnowledgeBase() {
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

  useEffect(() => {
    loadEntries();
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-600 mt-1">Manage AI training content and policies</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <span>➕</span>
          Add Entry
        </button>
      </div>

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
                    <button
                      onClick={() => startEditing(entry)}
                      className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
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
    </div>
  );
}
