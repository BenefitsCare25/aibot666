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
  send_time: '08:00',
  is_active: true
};

function resolvePreview(text) {
  if (!text) return text;
  const now = new Date();
  const month = now.toLocaleString('en-SG', { month: 'long' });
  const year = String(now.getFullYear());
  return text.replace(/<<current month>>/gi, month).replace(/<<current year>>/gi, year);
}

const COL_LABELS = {
  recipientEmail: 'Recipient Email',
  recipientName:  'Recipient Name',
  bodyContent:    'Body Content',
  subject:        'Subject',
  portalName:     'Portal Name',
  ccList:         'CC List',
  recurringDay:   'Recurring Day',
  scheduledDate:  'Scheduled Date',
  sendTime:       'Send Time',
  listingType:    'Listing Type',
};

const REQUIRED_COLS = ['recipientEmail', 'recipientName', 'bodyContent', 'subject'];

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
  const [previewing, setPreviewing] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // null | preview result
  const [importing, setImporting] = useState(false);

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
      portal_name:    record.portal_name    || '',
      listing_type:   record.listing_type   || '',
      recipient_email: record.recipient_email || '',
      cc_list:        record.cc_list        || '',
      recipient_name: record.recipient_name || '',
      subject:        record.subject        || '',
      body_content:   record.body_content   || '',
      recurring_day:  record.recurring_day  != null ? String(record.recurring_day) : '',
      scheduled_date: record.scheduled_date ? record.scheduled_date.slice(0, 10) : '',
      send_time:      record.send_time      || '08:00',
      is_active:      record.is_active !== false
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
        recurring_day:  formData.recurring_day !== '' ? parseInt(formData.recurring_day) : null,
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

  // ── Import flow ─────────────────────────────────────────────────────────────

  const resetImport = () => {
    setImportFile(null);
    setImportPreview(null);
  };

  const handleFileChange = (e) => {
    setImportFile(e.target.files[0] || null);
    setImportPreview(null);
  };

  const handlePreview = async () => {
    if (!importFile) return;
    setPreviewing(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await emailAutomationApi.importPreview(fd);
      setImportPreview(res);
    } catch (err) {
      setError(err.message || 'Failed to parse file');
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await emailAutomationApi.importExcel(fd);
      showSuccess(`Imported ${res.imported} record(s) — ${res.inserted} new, ${res.updated} updated`);
      setShowImport(false);
      resetImport();
      loadRecords();
    } catch (err) {
      const detail = err.response?.data?.details;
      setError(detail ? `${err.message}: ${detail}` : (err.message || 'Failed to import'));
    } finally {
      setImporting(false);
    }
  };

  const insertPlaceholder = (field, placeholder) => {
    setFormData(prev => ({ ...prev, [field]: prev[field] + placeholder }));
  };

  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  const canImport = importPreview && importPreview.errors.length === 0 && importPreview.totalRows > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Automation</h1>
          <p className="text-sm text-gray-500 mt-1">Monthly panel listing reminder emails — scheduled by Singapore time</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(true); resetImport(); }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <span>📥</span> Import Excel
          </button>
          <button onClick={openNew}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <span>+</span> New Record
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm whitespace-pre-wrap">{error}</div>}
      {successMessage && <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">{successMessage}</div>}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No records. Add one or import from Excel.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Portal Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Recipient</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Subject Preview</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Schedule</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Send Time (SGT)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Last Sent</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Active</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[140px]">
                      <div className="truncate" title={r.portal_name}>{r.portal_name || '—'}</div>
                      {r.listing_type && <div className="text-xs text-gray-400 truncate">{r.listing_type}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{r.recipient_name}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[160px]">{r.recipient_email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                      <span className="truncate block" title={resolvePreview(r.subject)}>
                        {resolvePreview(r.subject)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {r.recurring_day != null && <div>Day {r.recurring_day} monthly</div>}
                      {r.scheduled_date && <div>{r.scheduled_date.slice(0, 10)}</div>}
                      {r.recurring_day == null && !r.scheduled_date && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm font-mono">
                      {r.send_time || '08:00'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.last_sent_at
                        ? new Date(r.last_sent_at).toLocaleDateString('en-SG')
                        : <span className="text-gray-400">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleActive(r)}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${r.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transform transition-transform ${r.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(r)} title="Edit"
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">✏️</button>
                        <button onClick={() => handleSendNow(r.id)} disabled={sendingId === r.id} title="Send Now"
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50">
                          {sendingId === r.id ? '⏳' : '📤'}
                        </button>
                        <button onClick={() => handleDelete(r.id)} title="Delete"
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit / Create Modal ── */}
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
                  <input required value={formData.portal_name}
                    onChange={e => setFormData(p => ({ ...p, portal_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. CBRE" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Listing Type</label>
                  <input value={formData.listing_type}
                    onChange={e => setFormData(p => ({ ...p, listing_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. GP Panel" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name *</label>
                <input required value={formData.recipient_name}
                  onChange={e => setFormData(p => ({ ...p, recipient_name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email(s) * <span className="text-gray-400 font-normal">(one per line or comma-separated)</span>
                </label>
                <textarea required rows={2} value={formData.recipient_email}
                  onChange={e => setFormData(p => ({ ...p, recipient_email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CC List <span className="text-gray-400 font-normal">(one per line or comma-separated)</span>
                </label>
                <textarea rows={2} value={formData.cc_list}
                  onChange={e => setFormData(p => ({ ...p, cc_list: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <div className="flex gap-1 mb-1">
                  {['<<Current Month>>', '<<Current Year>>'].map(ph => (
                    <button key={ph} type="button" onClick={() => insertPlaceholder('subject', ph)}
                      className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100">
                      {ph}
                    </button>
                  ))}
                </div>
                <input required value={formData.subject}
                  onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {formData.subject && (
                  <p className="text-xs text-gray-500 mt-1">Preview: {resolvePreview(formData.subject)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Content *</label>
                <div className="flex gap-1 mb-1">
                  {['<<Current Month>>', '<<Current Year>>'].map(ph => (
                    <button key={ph} type="button" onClick={() => insertPlaceholder('body_content', ph)}
                      className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100">
                      {ph}
                    </button>
                  ))}
                </div>
                <textarea required rows={6} value={formData.body_content}
                  onChange={e => setFormData(p => ({ ...p, body_content: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email body (after 'Dear [Name],')" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recurring Day <span className="text-gray-400 font-normal">(1–28)</span></label>
                  <select value={formData.recurring_day}
                    onChange={e => setFormData(p => ({ ...p, recurring_day: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— None —</option>
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">One-time Date</label>
                  <input type="date" value={formData.scheduled_date}
                    onChange={e => setFormData(p => ({ ...p, scheduled_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Send Time (SGT)</label>
                  <input type="time" value={formData.send_time}
                    onChange={e => setFormData(p => ({ ...p, send_time: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setFormData(p => ({ ...p, is_active: !p.is_active }))}
                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${formData.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
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

      {/* ── Import Modal ── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Import from Excel</h2>
              <button onClick={() => { setShowImport(false); resetImport(); }}
                className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Step 1: File picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Excel file</label>
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange}
                  className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                {importFile && <p className="text-xs text-gray-500 mt-1">Selected: {importFile.name}</p>}
              </div>

              {/* Step 2: Preview button */}
              {importFile && !importPreview && (
                <button onClick={handlePreview} disabled={previewing}
                  className="w-full py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                  {previewing ? 'Analysing file...' : '🔍 Validate & Preview'}
                </button>
              )}

              {/* Step 3: Validation result */}
              {importPreview && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500">
                    Sheet used: <span className="font-medium text-gray-700">{importPreview.usedSheet}</span>
                    {importPreview.sheetNames.length > 1 && (
                      <span className="ml-2 text-gray-400">({importPreview.sheetNames.join(', ')})</span>
                    )}
                  </div>

                  {/* Column detection */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">Column Detection</div>
                    <div className="divide-y">
                      {Object.entries(importPreview.columnStatus).map(([key, { found, required }]) => (
                        <div key={key} className="flex items-center justify-between px-3 py-1.5 text-xs">
                          <span className="text-gray-700">
                            {COL_LABELS[key]}
                            {required && <span className="text-red-500 ml-1">*</span>}
                          </span>
                          <span className={found ? 'text-green-600 font-medium' : required ? 'text-red-500 font-medium' : 'text-gray-400'}>
                            {found ? '✓ Found' : required ? '✗ Missing' : '— Not found'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Errors */}
                  {importPreview.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-red-700 mb-1">Cannot import — required columns missing:</p>
                      {importPreview.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-600">• {e}</p>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {importPreview.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      {importPreview.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-yellow-700">⚠ {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Row count */}
                  {importPreview.errors.length === 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                      ✓ Ready to import <strong>{importPreview.totalRows}</strong> record(s)
                    </div>
                  )}

                  {/* Sample preview */}
                  {importPreview.preview?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">First {importPreview.preview.length} record(s):</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {importPreview.preview.map((r, i) => (
                          <div key={i} className="text-xs bg-gray-50 rounded px-2 py-1.5 border">
                            <span className="font-medium">{r.portal_name || '(no portal name)'}</span>
                            <span className="text-gray-500 ml-2">→ {r.recipient_name} &lt;{r.recipient_email}&gt;</span>
                            <span className="text-blue-500 ml-2">{r.send_time} SGT</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => setImportPreview(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline">
                    Choose a different file
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t">
                <button onClick={() => { setShowImport(false); resetImport(); }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleImport} disabled={!canImport || importing}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {importing ? 'Importing...' : `Import ${importPreview?.totalRows ?? ''} Records`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
