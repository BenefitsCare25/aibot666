import { useState, useEffect } from 'react';
import { emailAutomationApi } from '../api/emailAutomation';

const EMPTY_FORM = {
  portal_name: '',
  listing_type: '',
  recipient_email: '',
  cc_list: '',
  recipient_name: '',
  subject: '',
  body_content: '',
  recurring_day: '',
  scheduled_date: '',
  is_active: true
};

function resolvePreview(text) {
  if (!text) return text;
  const now = new Date();
  const month = now.toLocaleString('en-SG', { month: 'long' });
  const year = String(now.getFullYear());
  return text.replace(/<<current month>>/gi, month).replace(/<<current year>>/gi, year);
}

export default function EmailAutomation() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  // Send confirm
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const res = await emailAutomationApi.getAll();
      setRecords(res.data || []);
      setError('');
    } catch (err) {
      setError('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const openNew = () => {
    setEditingRecord(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setFormData({
      portal_name: record.portal_name || '',
      listing_type: record.listing_type || '',
      recipient_email: record.recipient_email || '',
      cc_list: record.cc_list || '',
      recipient_name: record.recipient_name || '',
      subject: record.subject || '',
      body_content: record.body_content || '',
      recurring_day: record.recurring_day != null ? String(record.recurring_day) : '',
      scheduled_date: record.scheduled_date ? record.scheduled_date.slice(0, 10) : '',
      is_active: record.is_active !== false
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...formData,
        recurring_day: formData.recurring_day !== '' ? parseInt(formData.recurring_day) : null,
        scheduled_date: formData.scheduled_date || null
      };
      if (editingRecord) {
        await emailAutomationApi.update(editingRecord.id, payload);
        showSuccess('Record updated successfully');
      } else {
        await emailAutomationApi.create(payload);
        showSuccess('Record created successfully');
      }
      setShowModal(false);
      loadRecords();
    } catch (err) {
      setError(err.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this email automation record?')) return;
    try {
      await emailAutomationApi.remove(id);
      showSuccess('Record deleted');
      loadRecords();
    } catch (err) {
      setError(err.message || 'Failed to delete record');
    }
  };

  const handleToggleActive = async (record) => {
    try {
      await emailAutomationApi.update(record.id, { ...record, is_active: !record.is_active });
      loadRecords();
    } catch (err) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleSendNow = async (id) => {
    if (!window.confirm('Send this email now?')) return;
    setSendingId(id);
    try {
      await emailAutomationApi.sendNow(id);
      showSuccess('Email sent successfully');
      loadRecords();
    } catch (err) {
      setError(err.message || 'Failed to send email');
    } finally {
      setSendingId(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setError('');
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', importFile);
      const res = await emailAutomationApi.importExcel(formDataObj);
      showSuccess(`Imported ${res.imported} record(s) successfully`);
      setShowImport(false);
      setImportFile(null);
      loadRecords();
    } catch (err) {
      setError(err.message || 'Failed to import file');
    } finally {
      setImporting(false);
    }
  };

  const insertPlaceholder = (field, placeholder) => {
    setFormData(prev => ({ ...prev, [field]: prev[field] + placeholder }));
  };

  const days = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Automation</h1>
          <p className="text-sm text-gray-500 mt-1">Manage monthly panel listing reminder emails</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <span>📥</span> Import Excel
          </button>
          <button
            onClick={openNew}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <span>+</span> New Record
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No records found. Add one or import from Excel.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Portal Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Recipient</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Subject Preview</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Schedule</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Last Sent</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Active</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {r.portal_name}
                      {r.listing_type && <div className="text-xs text-gray-400">{r.listing_type}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{r.recipient_name}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[180px]">{r.recipient_email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                      <span className="truncate block" title={resolvePreview(r.subject)}>
                        {resolvePreview(r.subject)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.recurring_day != null && <div>Day {r.recurring_day} monthly</div>}
                      {r.scheduled_date && <div>{r.scheduled_date.slice(0, 10)}</div>}
                      {r.recurring_day == null && !r.scheduled_date && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.last_sent_at
                        ? new Date(r.last_sent_at).toLocaleDateString('en-SG')
                        : <span className="text-gray-400">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(r)}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${r.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform ${r.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          title="Edit"
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >✏️</button>
                        <button
                          onClick={() => handleSendNow(r.id)}
                          disabled={sendingId === r.id}
                          title="Send Now"
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                        >{sendingId === r.id ? '⏳' : '📤'}</button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          title="Delete"
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRecord ? 'Edit Record' : 'New Record'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Portal Name *</label>
                  <input
                    required
                    value={formData.portal_name}
                    onChange={e => setFormData(p => ({ ...p, portal_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. CBRE"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Listing Type</label>
                  <input
                    value={formData.listing_type}
                    onChange={e => setFormData(p => ({ ...p, listing_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. GP Panel"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name *</label>
                <input
                  required
                  value={formData.recipient_name}
                  onChange={e => setFormData(p => ({ ...p, recipient_name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email(s) * <span className="text-gray-400 font-normal">(one per line or comma-separated)</span></label>
                <textarea
                  required
                  rows={2}
                  value={formData.recipient_email}
                  onChange={e => setFormData(p => ({ ...p, recipient_email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CC List <span className="text-gray-400 font-normal">(one per line or comma-separated)</span></label>
                <textarea
                  rows={2}
                  value={formData.cc_list}
                  onChange={e => setFormData(p => ({ ...p, cc_list: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <div className="flex gap-1 mb-1 flex-wrap">
                  {['<<Current Month>>', '<<Current Year>>'].map(ph => (
                    <button key={ph} type="button" onClick={() => insertPlaceholder('subject', ph)}
                      className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100">
                      {ph}
                    </button>
                  ))}
                </div>
                <input
                  required
                  value={formData.subject}
                  onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formData.subject && (
                  <p className="text-xs text-gray-500 mt-1">Preview: {resolvePreview(formData.subject)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Content *</label>
                <div className="flex gap-1 mb-1 flex-wrap">
                  {['<<Current Month>>', '<<Current Year>>'].map(ph => (
                    <button key={ph} type="button" onClick={() => insertPlaceholder('body_content', ph)}
                      className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100">
                      {ph}
                    </button>
                  ))}
                </div>
                <textarea
                  required
                  rows={6}
                  value={formData.body_content}
                  onChange={e => setFormData(p => ({ ...p, body_content: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email body (after 'Dear [Name],'). Use <<Current Month>> and <<Current Year>> for dynamic dates."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recurring Day <span className="text-gray-400 font-normal">(1–28)</span></label>
                  <select
                    value={formData.recurring_day}
                    onChange={e => setFormData(p => ({ ...p, recurring_day: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— None —</option>
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">One-time Date</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={e => setFormData(p => ({ ...p, scheduled_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, is_active: !p.is_active }))}
                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${formData.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform ${formData.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-gray-700">Active</span>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Import from Excel</h2>
              <button onClick={() => { setShowImport(false); setImportFile(null); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Upload an Excel file with an <strong>"Email Automation"</strong> sheet. Expected columns:
                Portal Name, Recipient Email, CC List, Recipient Name, Body Email Content, Email Subject.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={e => setImportFile(e.target.files[0])}
                className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {importFile && <p className="text-xs text-gray-500">Selected: {importFile.name}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowImport(false); setImportFile(null); }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleImport} disabled={!importFile || importing}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
