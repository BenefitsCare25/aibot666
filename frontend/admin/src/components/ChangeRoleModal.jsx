/**
 * Change Role Modal Component
 * Allows Super Admin to change user roles dynamically from database
 */

import { useState, useEffect } from 'react';
import { updateAdminUser } from '../api/adminUsers';
import { getAllRoles } from '../api/roles';

export default function ChangeRoleModal({ user, currentUserRole, onClose, onSuccess }) {
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(user.role_id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setIsLoadingRoles(true);
      const response = await getAllRoles();
      setRoles(response.roles || []);

      // Set initial selected role if user has one
      if (user.role_id) {
        setSelectedRoleId(user.role_id);
      }
    } catch (err) {
      setError('Failed to load roles: ' + err.message);
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedRoleId === user.role_id) {
      setError('Please select a different role');
      return;
    }

    if (!selectedRoleId) {
      setError('Please select a role');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await updateAdminUser(user.id, { roleId: selectedRoleId });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find current and selected role details
  const currentRole = roles.find(r => r.id === user.role_id);
  const selectedRole = roles.find(r => r.id === selectedRoleId);

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

          {isLoadingRoles ? (
            <div className="text-center py-4">
              <p className="text-gray-500">Loading roles...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User: <span className="font-semibold">{user.username}</span>
                </label>
                <p className="text-sm text-gray-500 mb-4">
                  Current Role: <span className="font-semibold">{currentRole?.name || 'None'}</span>
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Role
                </label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting || roles.length === 0}
                >
                  <option value="">Select a role...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                      {role.is_system ? ' (System)' : ''}
                    </option>
                  ))}
                </select>
                {selectedRole && (
                  <p className="mt-2 text-xs text-gray-500">
                    {selectedRole.description || 'No description available'}
                    {selectedRole.permission_count !== undefined && (
                      <span className="block mt-1">
                        {selectedRole.permission_count} permission(s)
                      </span>
                    )}
                  </p>
                )}
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
                  disabled={isSubmitting || selectedRoleId === user.role_id || !selectedRoleId}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Updating...' : 'Update Role'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
