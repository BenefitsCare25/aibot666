import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';
import toast from 'react-hot-toast';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [frequentCategories, setFrequentCategories] = useState(null);
  const [queryTrends, setQueryTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all'); // 'today', 'week', 'month', 'all'

  useEffect(() => {
    loadDashboardData();
  }, [timeFilter]);

  const getDateRange = () => {
    const now = new Date();
    let startDate = null;

    switch (timeFilter) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
        break;
      case 'month':
        startDate = new Date(now.setDate(now.getDate() - 30)).toISOString();
        break;
      default:
        startDate = null;
    }

    return { startDate };
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const dateRange = getDateRange();

      // Load all data in parallel
      const [analyticsData, activityData, categoriesData, trendsData] = await Promise.all([
        analyticsApi.getAnalytics(dateRange),
        analyticsApi.getRecentActivity({ ...dateRange, limit: 10 }),
        analyticsApi.getFrequentCategories({ ...dateRange }),
        analyticsApi.getQueryTrends({ days: 7 })
      ]);

      setStats(analyticsData.data);
      setRecentActivity(activityData.data);
      setFrequentCategories(categoriesData.data);
      setQueryTrends(trendsData.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Chat (Unique Employee)',
      value: stats?.queries?.uniqueEmployees || 0,
      icon: '💬',
      color: 'bg-blue-500'
    },
    {
      title: 'Total Response from AI chatbot',
      value: stats?.queries?.totalResponses || 0,
      icon: '🤖',
      color: 'bg-purple-500'
    },
    {
      title: 'Escalations',
      value: stats?.escalations?.total || 0,
      icon: '🚨',
      color: 'bg-yellow-500'
    },
    {
      title: 'Escalation Rate',
      value: stats?.queries?.escalationRate ? `${stats.queries.escalationRate}%` : '0%',
      icon: '📊',
      color: 'bg-red-500'
    },
    {
      title: 'Resolution Rate',
      value: stats?.queries?.resolutionRate ? `${stats.queries.resolutionRate}%` : '0%',
      icon: '✅',
      color: 'bg-green-500'
    }
  ];

  // Prepare chart data
  const chartData = {
    labels: queryTrends.map(t => {
      const date = new Date(t.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        label: 'Daily Queries',
        data: queryTrends.map(t => t.queries),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Time Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your chatbot system</p>
        </div>

        {/* Time Filter Buttons */}
        <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
          {[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
            { value: 'all', label: 'All Time' }
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setTimeFilter(filter.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeFilter === filter.value
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statCards.map((stat) => (
          <div key={stat.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/employees"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <span className="text-2xl">👥</span>
            <div>
              <p className="font-medium text-gray-900">Manage Employees</p>
              <p className="text-sm text-gray-600">Add or edit employee data</p>
            </div>
          </Link>

          <Link
            to="/knowledge"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <span className="text-2xl">📚</span>
            <div>
              <p className="font-medium text-gray-900">Knowledge Base</p>
              <p className="text-sm text-gray-600">Update AI knowledge</p>
            </div>
          </Link>

          <Link
            to="/escalations"
            className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <span className="text-2xl">🚨</span>
            <div>
              <p className="font-medium text-gray-900">View Escalations</p>
              <p className="text-sm text-gray-600">
                {stats?.escalations?.pending || 0} pending
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* 7-Day Query Trend Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Query Trends (Last 7 Days)</h2>
        <div className="h-64">
          {queryTrends.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        {recentActivity.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {recentActivity.map((activity, index) => (
              <div key={activity.id || index} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors">
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    activity.status === 'escalated' ? 'bg-yellow-100' : 'bg-green-100'
                  }`}>
                    <span className="text-xl">{activity.status === 'escalated' ? '🚨' : '✅'}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.employeeName}</p>
                      <p className="text-xs text-gray-500">{activity.employeeEmail}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      activity.status === 'escalated'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2 line-clamp-2">{activity.question}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{new Date(activity.timestamp).toLocaleString()}</span>
                    {activity.confidence && (
                      <span>Confidence: {(activity.confidence * 100).toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No recent activity</p>
        )}
      </div>

      {/* Frequent Categories & Questions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Top Categories & Questions</h2>
        {frequentCategories?.topCategories?.length > 0 ? (
          <div className="space-y-6">
            {frequentCategories.topCategories.map((category, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{category.category}</h3>
                  <span className="text-sm text-gray-500">{category.totalUsage} uses</span>
                </div>

                {/* Usage bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min((category.totalUsage / frequentCategories.topCategories[0].totalUsage) * 100, 100)}%`
                    }}
                  />
                </div>

                {/* Top questions in this category */}
                {category.topQuestions?.length > 0 && (
                  <div className="pl-4 space-y-2">
                    {category.topQuestions.slice(0, 3).map((question, qIndex) => (
                      <div key={qIndex} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 flex-1">{question.title}</span>
                        <span className="text-gray-500 ml-2">{question.usage}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Unanswered Questions */}
            {frequentCategories.unansweredQuestions?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Frequently Escalated Questions</h3>
                <div className="space-y-2">
                  {frequentCategories.unansweredQuestions.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <span className="text-sm text-gray-700 flex-1">{item.question}</span>
                      <span className="text-xs font-medium text-yellow-800 ml-2">
                        {item.frequency}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No data available</p>
        )}
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">System Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-900">API Server</span>
            </div>
            <span className="text-sm text-green-600 font-medium">Online</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-900">OpenAI API</span>
            </div>
            <span className="text-sm text-green-600 font-medium">Connected</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-900">Database</span>
            </div>
            <span className="text-sm text-green-600 font-medium">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
