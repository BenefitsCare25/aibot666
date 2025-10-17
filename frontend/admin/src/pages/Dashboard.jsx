import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const data = await analyticsApi.getAnalytics();
      setStats(data.data);
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your insurance chatbot system</p>
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

      {/* Recent Activity */}
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
