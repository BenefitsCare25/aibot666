import { useState, useEffect } from 'react';
import { analyticsApi } from '../api/analytics';
import toast from 'react-hot-toast';

export default function Escalations() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

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
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    escalation.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {escalation.status}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Original Query:</p>
                <p className="text-gray-900">{escalation.query}</p>
              </div>

              {escalation.ai_response && (
                <div className="border-l-4 border-blue-500 pl-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">AI Response:</p>
                  <p className="text-sm text-gray-600">{escalation.ai_response}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Confidence: {Math.round(escalation.confidence_score * 100)}%
                  </p>
                </div>
              )}

              {escalation.resolution && (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-900 mb-2">Team Response:</p>
                  <p className="text-sm text-green-800">{escalation.resolution}</p>
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500">
                Created: {new Date(escalation.created_at).toLocaleString()}
                {escalation.resolved_at && (
                  <> • Resolved: {new Date(escalation.resolved_at).toLocaleString()}</>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
