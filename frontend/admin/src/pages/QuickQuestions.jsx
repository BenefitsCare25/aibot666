import { useState, useEffect } from 'react';
import { quickQuestionsApi } from '../api/quickQuestions';

const ICON_OPTIONS = [
  { value: 'shield', label: 'Shield (Coverage)', icon: '🛡️' },
  { value: 'document', label: 'Document (LOG)', icon: '📄' },
  { value: 'computer', label: 'Computer (Portal)', icon: '💻' },
  { value: 'clipboard', label: 'Clipboard (Claims)', icon: '📋' },
  { value: 'question', label: 'Question Mark', icon: '❓' },
  { value: 'info', label: 'Information', icon: 'ℹ️' }
];

export default function QuickQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    category_id: '',
    category_title: '',
    category_icon: 'question',
    question: '',
    answer: '',
    display_order: 0,
    is_active: true
  });

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const response = await quickQuestionsApi.getAll();
      setQuestions(response.data || []);
      setError('');
    } catch (err) {
      console.error('Error loading quick questions:', err);
      setError('Failed to load quick questions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      if (editingQuestion) {
        await quickQuestionsApi.update(editingQuestion.id, formData);
        setSuccessMessage('Question updated successfully');
      } else {
        await quickQuestionsApi.create(formData);
        setSuccessMessage('Question created successfully');
      }

      setShowForm(false);
      setEditingQuestion(null);
      resetForm();
      loadQuestions();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error saving question:', err);
      setError(err.response?.data?.details || 'Failed to save question');
    }
  };

  const handleEdit = (question) => {
    setEditingQuestion(question);
    setFormData({
      category_id: question.category_id,
      category_title: question.category_title,
      category_icon: question.category_icon,
      question: question.question,
      answer: question.answer,
      display_order: question.display_order,
      is_active: question.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      await quickQuestionsApi.delete(id);
      setSuccessMessage('Question deleted successfully');
      loadQuestions();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error deleting question:', err);
      setError(err.response?.data?.details || 'Failed to delete question');
    }
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      category_title: '',
      category_icon: 'question',
      question: '',
      answer: '',
      display_order: 0,
      is_active: true
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingQuestion(null);
    resetForm();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('Please upload a valid Excel file (.xlsx or .xls)');
        return;
      }
      setUploadFile(file);
      setError('');
    }
  };

  const handleUploadExcel = async () => {
    if (!uploadFile) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await quickQuestionsApi.uploadExcel(uploadFile, replaceExisting);
      setSuccessMessage(response.data.message || 'Excel file uploaded successfully');
      setShowUploadModal(false);
      setUploadFile(null);
      setReplaceExisting(false);
      loadQuestions();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error uploading Excel file:', err);
      setError(err.response?.data?.details || 'Failed to upload Excel file');
    } finally {
      setUploading(false);
    }
  };

  // Group questions by category
  const categorizedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.category_id]) {
      acc[q.category_id] = {
        title: q.category_title,
        icon: q.category_icon,
        questions: []
      };
    }
    acc[q.category_id].questions.push(q);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading quick questions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quick Questions</h1>
          <p className="text-gray-600 mt-1">Manage chatbot quick questions for your company</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Excel
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Add Question
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Upload Excel Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Upload Excel File</h2>

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
                  Replace all existing questions
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-1">Excel Format:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Column 2: Questions</li>
                  <li>• Column 3: Answers</li>
                  <li>• Section headers to group questions by category</li>
                  <li>• Example: "Letter of Guarantee (LOG)", "Portal Matters"</li>
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

      {/* Question Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingQuestion ? 'Edit Question' : 'Add New Question'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="benefit-coverage"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier (e.g., benefit-coverage)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category_title}
                    onChange={(e) => setFormData({ ...formData, category_title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Benefit Coverage"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Icon
                  </label>
                  <select
                    value={formData.category_icon}
                    onChange={(e) => setFormData({ ...formData, category_icon: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {ICON_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lower numbers appear first
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question *
                </label>
                <textarea
                  required
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={2}
                  placeholder="How do I check my coverage balance?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Answer *
                </label>
                <textarea
                  required
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={4}
                  placeholder="You can check your coverage balance by..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use \n for line breaks
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Active (visible to users)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingQuestion ? 'Update Question' : 'Create Question'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Questions by Category */}
      {Object.keys(categorizedQuestions).length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No quick questions found. Add your first question to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(categorizedQuestions).map(([categoryId, category]) => (
            <div key={categoryId} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {ICON_OPTIONS.find(i => i.value === category.icon)?.icon || '❓'} {category.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {category.questions.length} question{category.questions.length > 1 ? 's' : ''}
                </p>
              </div>

              <div className="divide-y divide-gray-200">
                {category.questions.map((question) => (
                  <div key={question.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900">{question.question}</h3>
                          {!question.is_active && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{question.answer}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Order: {question.display_order}</span>
                          <span>ID: {categoryId}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(question)}
                          className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(question.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">ℹ️ Quick Questions Guide</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li><strong>Category ID:</strong> Unique identifier for grouping questions (e.g., benefit-coverage)</li>
          <li><strong>Category Title:</strong> Display name shown to users (e.g., Benefit Coverage)</li>
          <li><strong>Display Order:</strong> Lower numbers appear first within each category</li>
          <li><strong>Active Status:</strong> Only active questions appear in the chatbot widget</li>
          <li><strong>Line Breaks:</strong> Use \n in answers for line breaks</li>
          <li><strong>Per Company:</strong> Each company has their own set of quick questions</li>
        </ul>
      </div>
    </div>
  );
}
