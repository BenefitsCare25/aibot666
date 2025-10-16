export default function Analytics() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Performance metrics and insights</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📈</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Dashboard</h3>
          <p className="text-gray-600 mb-4">
            This page will display comprehensive analytics and visualizations of your chatbot performance.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto text-left">
            <p className="text-sm text-blue-900 font-medium mb-2">Charts to implement:</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Query volume trends (line chart)</li>
              <li>• Confidence score distribution (histogram)</li>
              <li>• Escalation rate over time (area chart)</li>
              <li>• Category breakdown (pie chart)</li>
              <li>• Response time metrics (bar chart)</li>
              <li>• Popular questions (table)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
