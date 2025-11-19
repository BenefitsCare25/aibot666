/**
 * Permission Hook
 * Check user permissions in frontend components
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  // Fetch user permissions
  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch user's permissions from backend
      const response = await axios.get(`${API_URL}/api/auth/me/permissions`, {
        withCredentials: true
      });

      if (response.data.success) {
        setPermissions(response.data.permissions || []);
        setRole(response.data.role || null);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);

      // Fallback to legacy role system if new system not available
      if (user.role === 'super_admin') {
        // Super admin has all permissions
        setPermissions(['*']); // Wildcard = all permissions
        setRole({ name: 'Super Admin', is_system: true });
      } else {
        setPermissions([]);
        setRole({ name: 'Admin', is_system: false });
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  /**
   * Check if user has a specific permission
   * @param {string} permissionCode - Permission code (e.g., 'employees.view')
   * @returns {boolean}
   */
  const can = useCallback((permissionCode) => {
    if (!permissions || permissions.length === 0) return false;

    // Super admin with wildcard has all permissions
    if (permissions.includes('*')) return true;

    // Check specific permission
    return permissions.includes(permissionCode);
  }, [permissions]);

  /**
   * Check if user has ANY of the specified permissions
   * @param {...string} permissionCodes - Permission codes
   * @returns {boolean}
   */
  const canAny = useCallback((...permissionCodes) => {
    return permissionCodes.some(code => can(code));
  }, [can]);

  /**
   * Check if user has ALL of the specified permissions
   * @param {...string} permissionCodes - Permission codes
   * @returns {boolean}
   */
  const canAll = useCallback((...permissionCodes) => {
    return permissionCodes.every(code => can(code));
  }, [can]);

  /**
   * Check if user is Super Admin
   * @returns {boolean}
   */
  const isSuperAdmin = useCallback(() => {
    if (role && role.is_system) return true;
    if (user && user.role === 'super_admin') return true;
    if (permissions.includes('*')) return true;
    return false;
  }, [role, user, permissions]);

  /**
   * Check if user can access a specific resource
   * @param {string} resource - Resource name (e.g., 'employees', 'knowledge')
   * @param {string} action - Action (e.g., 'view', 'create', 'edit', 'delete')
   * @returns {boolean}
   */
  const canAccess = useCallback((resource, action = 'view') => {
    return can(`${resource}.${action}`);
  }, [can]);

  return {
    permissions,
    role,
    loading,
    can,
    canAny,
    canAll,
    canAccess,
    isSuperAdmin,
    refresh: fetchPermissions
  };
}

export default usePermissions;
