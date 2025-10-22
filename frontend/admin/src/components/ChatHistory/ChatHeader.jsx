export default function ChatHeader({ employee, conversationId, onExport, exporting }) {
  if (!employee) {
    return (
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="text-gray-500">Select a conversation to view details</div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Employee avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold shadow">
            {employee.name
              ?.split(' ')
              .map(part => part[0])
              .join('')
              .toUpperCase()
              .substring(0, 2) || '?'}
          </div>

          {/* Employee details */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{employee.name}</h2>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>{employee.email}</span>
              {employee.policy_type && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {employee.policy_type}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            disabled={exporting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            {exporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Exporting...
              </>
            ) : (
              <>
                <span>📥</span>
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Conversation ID */}
      <div className="mt-2 text-xs text-gray-500">
        Conversation ID: <span className="font-mono">{conversationId}</span>
      </div>
    </div>
  );
}
