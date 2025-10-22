import { Outlet, NavLink } from 'react-router-dom';
import { useState } from 'react';
import CompanySelector from './CompanySelector';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Employees', href: '/employees', icon: '👥' },
  { name: 'Knowledge Base', href: '/knowledge', icon: '📚' },
  { name: 'Chat History', href: '/chat-history', icon: '💬' },
  { name: 'Escalations', href: '/escalations', icon: '🚨' },
  { name: 'Analytics', href: '/analytics', icon: '📈' }
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-64 bg-sidebar-dark text-white flex-shrink-0`}>
        <div className="p-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>🏥</span>
            Insurance Admin
          </h1>
        </div>

        <nav className="mt-8">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white border-l-4 border-primary-400'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-700">
          <p className="text-xs text-gray-400">v1.0.0</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Company Selector */}
              <CompanySelector />
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Admin User</span>
              <button className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
