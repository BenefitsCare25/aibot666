import { useState, useEffect } from 'react';
import { chatHistoryApi } from '../../api/chatHistory';

export default function AdminAttendanceForm({ conversation, onUpdate }) {
  const [attendedBy, setAttendedBy] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Load existing attendance data when conversation changes
  useEffect(() => {
    if (conversation) {
      setAttendedBy(conversation.attended_by || '');
      setAdminNotes(conversation.admin_notes || '');
      setIsExpanded(false);
      setError(null);
      setSuccessMessage(null);
    }
  }, [conversation?.conversation_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!attendedBy.trim()) {
      setError('Admin name is required');
      return;
    }


    setSaving(true);

    try {
      const response = await chatHistoryApi.updateAttendance(
        conversation.conversation_id,
        attendedBy.trim(),
        adminNotes.trim() || null
      );


      if (response.success) {
        setSuccessMessage('Attendance recorded successfully');

        // Notify parent component to refresh
        if (onUpdate) {
          await onUpdate();
        }

        // Keep expanded to show success message for 2 seconds, then collapse
        setTimeout(() => {
          setIsExpanded(false);
        }, 2000);

        // Clear success message after 4 seconds
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        console.error('❌ Failed response:', response);
        setError(response.error || 'Failed to save attendance');
      }
    } catch (err) {
      console.error('❌ Error saving attendance:', err);
      setError(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const hasAttendance = conversation?.attended_by;

  return (
    <div className="border-t border-gray-200 bg-white flex-shrink-0">
      {/* Collapsed State - Shows attendance info if exists */}
      {!isExpanded && (
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex-1">
            {hasAttendance ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✓ Attended
                  </span>
                  <span className="text-sm text-gray-600">
                    by <span className="font-medium">{conversation.attended_by}</span>
                  </span>
                  {conversation.attended_at && (
                    <span className="text-xs text-gray-400">
                      on {new Date(conversation.attended_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {conversation.admin_notes && (
                  <p className="text-sm text-gray-600 line-clamp-1">
                    Note: {conversation.admin_notes}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No admin attendance recorded</p>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="ml-4 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {hasAttendance ? 'Edit' : 'Add Attendance'}
          </button>
        </div>
      )}

      {/* Expanded State - Form */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Admin Attendance
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setError(null);
                // Reset to original values
                setAttendedBy(conversation.attended_by || '');
                setAdminNotes(conversation.admin_notes || '');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Admin Name */}
          <div>
            <label htmlFor="attendedBy" className="block text-sm font-medium text-gray-700 mb-1">
              Admin Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="attendedBy"
              value={attendedBy}
              onChange={(e) => setAttendedBy(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={saving}
            />
          </div>

          {/* Admin Notes */}
          <div>
            <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700 mb-1">
              Summary Notes
            </label>
            <textarea
              id="adminNotes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add summary notes for reference (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={saving}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{successMessage}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setError(null);
                // Reset to original values
                setAttendedBy(conversation.attended_by || '');
                setAdminNotes(conversation.admin_notes || '');
              }}
              disabled={saving}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
