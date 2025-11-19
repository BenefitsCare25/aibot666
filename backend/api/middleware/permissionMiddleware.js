/**
 * Permission Middleware
 * Protect routes based on role permissions
 */

import { hasPermission, hasAnyPermission, hasAllPermissions, isSuperAdmin } from '../services/permissionService.js';

/**
 * Middleware to require a specific permission
 * @param {string} permissionCode - Required permission code (e.g., 'employees.view')
 * @returns {Function} - Express middleware
 */
export function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const allowed = await hasPermission(req.user.id, permissionCode);

      if (!allowed) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You do not have permission to perform this action. Required permission: ${permissionCode}`
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify permissions'
      });
    }
  };
}

/**
 * Middleware to require ANY of the specified permissions
 * @param {Array<string>} permissionCodes - Array of permission codes
 * @returns {Function} - Express middleware
 */
export function requireAnyPermission(...permissionCodes) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const allowed = await hasAnyPermission(req.user.id, permissionCodes);

      if (!allowed) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You do not have permission to perform this action. Required: any of ${permissionCodes.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify permissions'
      });
    }
  };
}

/**
 * Middleware to require ALL of the specified permissions
 * @param {Array<string>} permissionCodes - Array of permission codes
 * @returns {Function} - Express middleware
 */
export function requireAllPermissions(...permissionCodes) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const allowed = await hasAllPermissions(req.user.id, permissionCodes);

      if (!allowed) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You do not have permission to perform this action. Required: all of ${permissionCodes.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify permissions'
      });
    }
  };
}

/**
 * Middleware to require Super Admin role
 * This is a convenience wrapper that works with both new RBAC and legacy role system
 * @returns {Function} - Express middleware
 */
export function requireSuperAdminPermission() {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const superAdmin = await isSuperAdmin(req.user.id);

      if (!superAdmin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'This action requires Super Admin privileges'
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify permissions'
      });
    }
  };
}

export default {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireSuperAdminPermission
};
