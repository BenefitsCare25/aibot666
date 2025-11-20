/**
 * Create Admin User Modal
 * Form to create new admin accounts (Super Admin only)
 */

import { useState, useEffect } from 'react';
import { createAdminUser } from '../api/adminUsers';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function CreateAdminModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'admin',
    roleId: '',
    fullName: '',
    email: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [useNewRoleSystem, setUseNewRoleSystem] = useState(false);

  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(formData.password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(formData.password) },
    { label: 'Contains number', met: /[0-9]/.test(formData.password) },
    { label: 'Contains special character (!@#$%^&*)', met: /[!@#$%^&*]/.test(formData.password) }
  ];

  const allRequirementsMet = passwordRequirements.every(req => req.met);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);
      const response = await axios.get(`${API_URL}/api/roles`, {
        withCredentials: true
      });

      if (response.data.success && response.data.roles && response.data.roles.length > 0) {
        setRoles(response.data.roles);
        setUseNewRoleSystem(true);
        const defaultRole = response.data.roles.find(r => !r.is_system) || response.data.roles[0];
        setFormData(prev => ({ ...prev, roleId: defaultRole.id }));
      } else {
        setUseNewRoleSystem(false);
        setFormData(prev => ({ ...prev, role: 'admin' }));
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      setUseNewRoleSystem(false);
      setFormData(prev => ({ ...prev, role: 'admin' }));
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!allRequirementsMet) {
      setError('Password does not meet requirements');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        username: formData.username,
        password: formData.password,
        fullName: formData.fullName,
        email: formData.email
      };

      if (useNewRoleSystem && formData.roleId) {
        payload.roleId = formData.roleId;
      } else {
        payload.role = formData.role;
      }

      await createAdminUser(payload);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create admin user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Create New Admin User</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9_\-]+"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="admin_user"
                />
                <p className="mt-1 text-xs text-gray-500">Letters, numbers, underscore, and hyphen only</p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  maxLength={255}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="admin@example.com"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              {loadingRoles ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                  Loading roles...
                </div>
              ) : useNewRoleSystem ? (
                <>
                  <select
                    name="roleId"
                    value={formData.roleId}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a role...</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name} {role.is_system && '(System)'}
                        {role.permission_count > 0 && ` - ${role.permission_count} permissions`}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Assign a role to define user permissions
                  </p>
                </>
              ) : (
                <>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Super Admin can manage other admin users
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</p>
              <ul className="space-y-1">
                {passwordRequirements.map((req, idx) => (
                  <li key={idx} className="text-sm flex items-center">
                    <span className={`mr-2 ${req.met ? 'text-green-600' : 'text-gray-400'}`}>
                      {req.met ? '✓' : '○'}
                    </span>
                    <span className={req.met ? 'text-gray-700' : 'text-gray-500'}>
                      {req.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4 border-t">
              <button
                type="submit"
                disabled={isSubmitting || !allRequirementsMet}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {isSubmitting ? 'Creating...' : 'Create Admin User'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
