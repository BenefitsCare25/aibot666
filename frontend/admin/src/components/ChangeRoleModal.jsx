/**
 * Change Role Modal Component
 * Allows Super Admin to change user roles
 */

import { useState } from 'react';
import { updateAdminUser } from '../api/adminUsers';

export default function ChangeRoleModal({ user, currentUserRole, onClose, onSuccess }) {
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedRole === user.role) {
      setError('Please select a different role');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await updateAdminUser(user.id, { role: selectedRole });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            Change User Role
          </h3>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User: <span className="font-semibold">{user.username}</span>
              </label>
              <p className="text-sm text-gray-500 mb-4">
                Current Role: <span className="font-semibold">{user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              >
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
              </select>
              <p className="mt-2 text-xs text-gray-500">
                {selectedRole === 'super_admin'
                  ? 'Super Admins have full system access and can manage other admin users.'
                  : 'Admins have standard administrative access but cannot manage other admin users.'}
              </p>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedRole === user.role}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
