/**
 * Admin Users Management Page
 * Super Admin only - manage admin accounts
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../api/adminUsers';
import { resetPassword } from '../api/auth';
import CreateAdminModal from '../components/CreateAdminModal';
import ResetPasswordModal from '../components/ResetPasswordModal';
import ChangeRoleModal from '../components/ChangeRoleModal';

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setError('');
      const response = await getAllAdminUsers();
      setUsers(response.users || []);
    } catch (err) {
      setError('Failed to load admin users: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = (targetUser) => {
    setSelectedUser(targetUser);
    setShowResetModal(true);
  };

  const handleChangeRole = (targetUser) => {
    setSelectedUser(targetUser);
    setShowChangeRoleModal(true);
  };

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      setError('');
      await updateAdminUser(userId, { isActive: !currentStatus });
      setSuccess('User status updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      loadUsers();
    } catch (err) {
      setError('Failed to update user status: ' + err.message);
    }
  };

  const handleCreateSuccess = () => {
    setSuccess('Admin user created successfully');
    setTimeout(() => setSuccess(''), 3000);
    setShowCreateModal(false);
    loadUsers();
  };

  const handleResetSuccess = (username) => {
    setSuccess(`Password reset successfully for ${username}`);
    setTimeout(() => setSuccess(''), 3000);
    setShowResetModal(false);
    setSelectedUser(null);
  };

  const handleRoleChangeSuccess = () => {
    setSuccess('User role updated successfully');
    setTimeout(() => setSuccess(''), 3000);
    setShowChangeRoleModal(false);
    setSelectedUser(null);
    loadUsers();
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <div className="text-gray-600">Loading admin users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
          <p className="text-sm text-gray-600 mt-1">Manage administrator accounts and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + Create Admin User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{success}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Full Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                  No admin users found
                </td>
              </tr>
            ) : (
              users.map((adminUser) => (
                <tr key={adminUser.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {adminUser.username}
                    {adminUser.id === user.id && (
                      <span className="ml-2 text-xs text-blue-600">(You)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {adminUser.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {adminUser.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      adminUser.role_name === 'Super Admin' || adminUser.role === 'super_admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {adminUser.role_name || (adminUser.role === 'super_admin' ? 'Super Admin' : 'Admin')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      adminUser.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {adminUser.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {adminUser.last_login
                      ? new Date(adminUser.last_login).toLocaleDateString() + ' ' + new Date(adminUser.last_login).toLocaleTimeString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => handleChangeRole(adminUser)}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      Change Role
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => handleResetPassword(adminUser)}
                      disabled={adminUser.id === user.id}
                      className={`text-blue-600 hover:text-blue-800 ${
                        adminUser.id === user.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      Reset Password
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => handleToggleActive(adminUser.id, adminUser.is_active)}
                      disabled={adminUser.id === user.id}
                      className={`${
                        adminUser.is_active ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'
                      } ${adminUser.id === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {adminUser.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateAdminModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {showResetModal && selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          onClose={() => {
            setShowResetModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => handleResetSuccess(selectedUser.username)}
        />
      )}

      {showChangeRoleModal && selectedUser && (
        <ChangeRoleModal
          user={selectedUser}
          currentUserRole={user.role}
          onClose={() => {
            setShowChangeRoleModal(false);
            setSelectedUser(null);
          }}
          onSuccess={handleRoleChangeSuccess}
        />
      )}
    </div>
  );
}
