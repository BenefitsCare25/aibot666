import { useState, useEffect } from 'react';
import { analyticsApi } from '../api/analytics';
import toast from 'react-hot-toast';

export default function Escalations() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [editingResolution, setEditingResolution] = useState(null);
  const [resolutionText, setResolutionText] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [addToKB, setAddToKB] = useState(true);

  useEffect(() => {
    loadEscalations();
  }, [filter]);

  const loadEscalations = async () => {
    try {
      const response = await analyticsApi.getEscalations({ status: filter });
      setEscalations(response.data.escalations);
    } catch (error) {
      toast.error('Failed to load escalations');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (escalationId, newStatus) => {
    // If changing to resolved, show the resolution editor first
    if (newStatus === 'resolved') {
      const escalation = escalations.find(e => e.id === escalationId);
      setEditingResolution(escalationId);
      setResolutionText(escalation.resolution || '');
      setAddToKB(true);
      return;
    }

    // For other status changes, update immediately
    setUpdatingStatus(escalationId);
    try {
      const response = await analyticsApi.updateEscalation(escalationId, {
        status: newStatus,
        resolved_by: 'Admin User'
      });

      setEscalations(escalations.map(esc =>
        esc.id === escalationId ? { ...esc, ...response.data } : esc
      ));

      toast.success('Status updated successfully');
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const startEditingResolution = (escalationId, currentResolution) => {
    setEditingResolution(escalationId);
    setResolutionText(currentResolution || '');
    setAddToKB(false); // Don't add to KB when just editing existing resolution
  };

  const saveResolution = async (escalationId) => {
    if (!resolutionText.trim()) {
      toast.error('Please enter a resolution');
      return;
    }

    setUpdatingStatus(escalationId);
    try {
      const escalation = escalations.find(e => e.id === escalationId);
      const isMarkingResolved = escalation.status !== 'resolved';

      const response = await analyticsApi.updateEscalation(escalationId, {
        resolution: resolutionText,
        status: isMarkingResolved ? 'resolved' : escalation.status,
        resolved_by: 'Admin User',
        add_to_kb: isMarkingResolved && addToKB
      });

      setEscalations(escalations.map(esc =>
        esc.id === escalationId ? { ...esc, ...response.data } : esc
      ));

      setEditingResolution(null);
      setResolutionText('');

      if (isMarkingResolved && addToKB) {
        toast.success('Escalation resolved and added to Knowledge Base');
      } else {
        toast.success('Resolution saved successfully');
      }
    } catch (error) {
      toast.error('Failed to save resolution');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const cancelEditResolution = () => {
    setEditingResolution(null);
    setResolutionText('');
    setAddToKB(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Escalations</h1>
        <p className="text-gray-600 mt-1">Manage queries escalated to support team</p>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'resolved'
                ? 'bg-green-100 text-green-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Resolved
          </button>
          <button
            onClick={() => setFilter('')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === '' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Escalations List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : escalations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Escalations</h3>
          <p className="text-gray-600">All queries are being handled automatically!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {escalations.map((escalation) => (
            <div key={escalation.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {escalation.employees?.name || 'Unknown Employee'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {escalation.employees?.email} • {escalation.employees?.policy_type}
                  </p>
                </div>

                {/* Inline Status Dropdown */}
                <div className="relative">
                  <select
                    value={escalation.status}
                    onChange={(e) => handleStatusChange(escalation.id, e.target.value)}
                    disabled={updatingStatus === escalation.id}
                    className={`px-3 py-1 rounded-full text-sm font-semibold border-2 cursor-pointer
                      ${escalation.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:border-yellow-400'
                        : escalation.status === 'resolved'
                        ? 'bg-green-100 text-green-800 border-green-300 hover:border-green-400'
                        : 'bg-gray-100 text-gray-800 border-gray-300 hover:border-gray-400'
                      } ${updatingStatus === escalation.id ? 'opacity-50' : ''}
                    `}
                  >
                    <option value="pending">pending</option>
                    <option value="resolved">resolved</option>
                    <option value="dismissed">dismissed</option>
                  </select>
                  {updatingStatus === escalation.id && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Original Query:</p>
                <p className="text-gray-900">{escalation.query}</p>
              </div>

              {escalation.context?.aiResponse && (
                <div className="border-l-4 border-blue-500 pl-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">AI Response:</p>
                  <p className="text-sm text-gray-600">{escalation.context.aiResponse}</p>
                  {escalation.context.confidence !== undefined && (
                    <p className="text-xs text-gray-500 mt-1">
                      Confidence: {Math.round(escalation.context.confidence * 100)}%
                    </p>
                  )}
                </div>
              )}

              {/* Team Response - Editable */}
              <div className="bg-green-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-green-900">Team Response:</p>
                  {escalation.resolution && editingResolution !== escalation.id && (
                    <button
                      onClick={() => startEditingResolution(escalation.id, escalation.resolution)}
                      className="text-xs text-green-700 hover:text-green-900 font-medium"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingResolution === escalation.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Enter your response to this escalation..."
                      className="w-full p-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows="4"
                    />

                    {escalation.status !== 'resolved' && (
                      <label className="flex items-center gap-2 text-sm text-green-800">
                        <input
                          type="checkbox"
                          checked={addToKB}
                          onChange={(e) => setAddToKB(e.target.checked)}
                          className="rounded border-green-300 text-green-600 focus:ring-green-500"
                        />
                        Add to Knowledge Base
                      </label>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => saveResolution(escalation.id)}
                        disabled={updatingStatus === escalation.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {updatingStatus === escalation.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEditResolution}
                        disabled={updatingStatus === escalation.id}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-green-800">
                    {escalation.resolution || (
                      <button
                        onClick={() => startEditingResolution(escalation.id, '')}
                        className="text-green-700 hover:text-green-900 font-medium"
                      >
                        + Add response
                      </button>
                    )}
                  </p>
                )}
              </div>

              {escalation.was_added_to_kb && (
                <div className="flex items-center gap-2 text-xs text-blue-600 mb-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Added to Knowledge Base
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500">
                Created: {new Date(escalation.created_at).toLocaleString()}
                {escalation.resolved_at && (
                  <> • Resolved: {new Date(escalation.resolved_at).toLocaleString()}</>
                )}
                {escalation.resolved_by && (
                  <> • By: {escalation.resolved_by}</>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
