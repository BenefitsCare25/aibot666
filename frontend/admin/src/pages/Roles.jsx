import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form state
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  useEffect(() => {
    fetchRoles();
    fetchAllPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/roles`, {
        withCredentials: true
      });
      setRoles(response.data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      showError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPermissions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/roles/all-permissions`, {
        withCredentials: true
      });
      setAllPermissions(response.data.grouped || {});
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const openCreateModal = () => {
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions([]);
    setShowCreateModal(true);
  };

  const openEditModal = async (role) => {
    try {
      // Fetch role details with permissions
      const response = await axios.get(`${API_URL}/api/roles/${role.id}`, {
        withCredentials: true
      });

      const roleData = response.data.role;
      setSelectedRole(roleData);
      setRoleName(roleData.name);
      setRoleDescription(roleData.description || '');
      setSelectedPermissions(roleData.permission_ids || []);
      setShowEditModal(true);
    } catch (error) {
      console.error('Error fetching role details:', error);
      showError('Failed to load role details');
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();

    if (selectedPermissions.length === 0) {
      showError('Please select at least one permission');
      return;
    }

    try {
      await axios.post(`${API_URL}/api/roles`, {
        name: roleName,
        description: roleDescription,
        permissions: selectedPermissions
      }, {
        withCredentials: true
      });

      showSuccess('Role created successfully');
      setShowCreateModal(false);
      fetchRoles();
    } catch (error) {
      console.error('Error creating role:', error);
      showError(error.response?.data?.message || 'Failed to create role');
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();

    if (selectedPermissions.length === 0) {
      showError('Please select at least one permission');
      return;
    }

    try {
      await axios.put(`${API_URL}/api/roles/${selectedRole.id}`, {
        name: roleName,
        description: roleDescription,
        permissions: selectedPermissions
      }, {
        withCredentials: true
      });

      showSuccess('Role updated successfully');
      setShowEditModal(false);
      fetchRoles();
    } catch (error) {
      console.error('Error updating role:', error);
      showError(error.response?.data?.message || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId, roleName) => {
    if (!window.confirm(`Are you sure you want to delete the role "${roleName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/roles/${roleId}`, {
        withCredentials: true
      });

      showSuccess('Role deleted successfully');
      fetchRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      showError(error.response?.data?.message || 'Failed to delete role');
    }
  };

  const togglePermission = (permissionId) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(id => id !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  };

  const toggleAllPermissionsInResource = (resource) => {
    const resourcePermissions = allPermissions[resource];
    if (!resourcePermissions) return;

    const resourcePermissionIds = resourcePermissions.map(p => p.id);
    const allSelected = resourcePermissionIds.every(id => selectedPermissions.includes(id));

    if (allSelected) {
      // Deselect all in this resource
      setSelectedPermissions(prev => prev.filter(id => !resourcePermissionIds.includes(id)));
    } else {
      // Select all in this resource
      setSelectedPermissions(prev => {
        const newSet = new Set([...prev, ...resourcePermissionIds]);
        return Array.from(newSet);
      });
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const showError = (message) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const getResourceIcon = (resource) => {
    const icons = {
      dashboard: '📊',
      employees: '👥',
      knowledge: '📚',
      quick_questions: '❓',
      chat: '💬',
      escalations: '🚨',
      companies: '🏢',
      ai_settings: '🤖',
      admin_users: '👤',
      roles: '🔐'
    };
    return icons[resource] || '📄';
  };

  const getResourceLabel = (resource) => {
    const labels = {
      dashboard: 'Dashboard',
      employees: 'Employees',
      knowledge: 'Knowledge Base',
      quick_questions: 'Quick Questions',
      chat: 'Chat History',
      escalations: 'Escalations',
      companies: 'Companies',
      ai_settings: 'AI Settings',
      admin_users: 'Admin Users',
      roles: 'Roles'
    };
    return labels[resource] || resource;
  };

  const getActionLabel = (action) => {
    const labels = {
      view: 'View',
      create: 'Create',
      edit: 'Edit',
      delete: 'Delete',
      upload: 'Upload',
      export: 'Export',
      mark_attendance: 'Mark Attendance',
      resolve: 'Resolve',
      manage_schema: 'Manage Schema',
      reset_password: 'Reset Password',
      view_audit: 'View Audit Logs'
    };
    return labels[action] || action;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Role Management</h1>
            <p className="text-gray-600 mt-1">Create and manage user roles with custom permissions</p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>+</span>
            Create Role
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {errorMessage}
        </div>
      )}

      {/* Roles Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Permissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Users
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-gray-900">
                      {role.name}
                      {role.is_system && (
                        <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                          System
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500 max-w-xs truncate">
                    {role.description || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {role.permission_count} permissions
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {role.user_count} users
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {!role.is_system ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(role)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        className="text-red-600 hover:text-red-900"
                        disabled={role.user_count > 0}
                        title={role.user_count > 0 ? 'Cannot delete role with assigned users' : ''}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400">Protected</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">Create New Role</h2>
            </div>

            <form onSubmit={handleCreateRole}>
              <div className="p-6 space-y-6">
                {/* Role Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., HR Manager, Support Agent, Content Editor"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Choose a descriptive name for this role</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                    placeholder="Brief description of this role's purpose"
                  />
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Permissions * <span className="text-gray-500 font-normal">({selectedPermissions.length} selected)</span>
                  </label>

                  <div className="space-y-4">
                    {Object.keys(allPermissions).sort().map((resource) => {
                      const resourcePerms = allPermissions[resource];
                      const allSelected = resourcePerms.every(p => selectedPermissions.includes(p.id));
                      const someSelected = resourcePerms.some(p => selectedPermissions.includes(p.id));

                      return (
                        <div key={resource} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center mb-3">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggleAllPermissionsInResource(resource)}
                              className="h-4 w-4 text-blue-600 rounded mr-3"
                              ref={el => {
                                if (el) el.indeterminate = someSelected && !allSelected;
                              }}
                            />
                            <span className="text-lg mr-2">{getResourceIcon(resource)}</span>
                            <span className="font-medium text-gray-900">{getResourceLabel(resource)}</span>
                          </div>
                          <div className="ml-7 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {resourcePerms.map((perm) => (
                              <label key={perm.id} className="flex items-center text-sm text-gray-700 hover:bg-gray-50 p-2 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(perm.id)}
                                  onChange={() => togglePermission(perm.id)}
                                  className="h-4 w-4 text-blue-600 rounded mr-2"
                                />
                                {getActionLabel(perm.action)}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal - Similar structure to Create Modal */}
      {showEditModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">Edit Role: {selectedRole.name}</h2>
            </div>

            <form onSubmit={handleUpdateRole}>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Permissions * <span className="text-gray-500 font-normal">({selectedPermissions.length} selected)</span>
                  </label>

                  <div className="space-y-4">
                    {Object.keys(allPermissions).sort().map((resource) => {
                      const resourcePerms = allPermissions[resource];
                      const allSelected = resourcePerms.every(p => selectedPermissions.includes(p.id));
                      const someSelected = resourcePerms.some(p => selectedPermissions.includes(p.id));

                      return (
                        <div key={resource} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center mb-3">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggleAllPermissionsInResource(resource)}
                              className="h-4 w-4 text-blue-600 rounded mr-3"
                              ref={el => {
                                if (el) el.indeterminate = someSelected && !allSelected;
                              }}
                            />
                            <span className="text-lg mr-2">{getResourceIcon(resource)}</span>
                            <span className="font-medium text-gray-900">{getResourceLabel(resource)}</span>
                          </div>
                          <div className="ml-7 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {resourcePerms.map((perm) => (
                              <label key={perm.id} className="flex items-center text-sm text-gray-700 hover:bg-gray-50 p-2 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(perm.id)}
                                  onChange={() => togglePermission(perm.id)}
                                  className="h-4 w-4 text-blue-600 rounded mr-2"
                                />
                                {getActionLabel(perm.action)}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
