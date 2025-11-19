/**
 * Permission Service
 * Handles role-based permission checks with Redis caching
 */

import { supabase } from '../../config/supabase.js';
import { redis } from '../utils/session.js';

// Cache TTL: 5 minutes (permissions don't change frequently)
const CACHE_TTL = 300;

/**
 * Get user's role and permissions from database
 * @param {string} userId - Admin user ID
 * @returns {Promise<Object>} - User role and permissions
 */
async function getUserRoleFromDB(userId) {
  try {
    // Get user with role information
    const { data: user, error: userError } = await supabase
      .from('admin_users')
      .select(`
        id,
        username,
        role,
        role_id,
        roles (
          id,
          name,
          is_system
        )
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error fetching user role:', userError);
      return null;
    }

    // If user has no role_id, fall back to legacy role field
    if (!user.role_id) {
      return {
        userId: user.id,
        username: user.username,
        legacyRole: user.role, // 'super_admin' or 'admin'
        roleName: user.role === 'super_admin' ? 'Super Admin' : 'Admin',
        isSystemRole: user.role === 'super_admin',
        permissions: [] // Will be handled by legacy system
      };
    }

    // Get role permissions
    const { data: rolePermissions, error: permError } = await supabase
      .from('role_permissions')
      .select(`
        permissions (
          id,
          code,
          resource,
          action
        )
      `)
      .eq('role_id', user.role_id);

    if (permError) {
      console.error('Error fetching role permissions:', permError);
      return null;
    }

    // Extract permission codes
    const permissions = rolePermissions.map(rp => rp.permissions.code);

    return {
      userId: user.id,
      username: user.username,
      roleId: user.roles.id,
      roleName: user.roles.name,
      isSystemRole: user.roles.is_system,
      permissions: permissions
    };
  } catch (error) {
    console.error('Error in getUserRoleFromDB:', error);
    return null;
  }
}

/**
 * Get user permissions with caching
 * @param {string} userId - Admin user ID
 * @returns {Promise<Array<string>>} - Array of permission codes
 */
export async function getUserPermissions(userId) {
  try {
    // Try to get from cache first
    const cacheKey = `user:${userId}:permissions`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const roleData = await getUserRoleFromDB(userId);

    if (!roleData) {
      return [];
    }

    // Super Admin has ALL permissions (bypass)
    if (roleData.isSystemRole || roleData.legacyRole === 'super_admin') {
      // Get all permission codes
      const { data: allPermissions } = await supabase
        .from('permissions')
        .select('code');

      const allPermCodes = allPermissions ? allPermissions.map(p => p.code) : [];

      // Cache for 5 minutes
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(allPermCodes));

      return allPermCodes;
    }

    // For regular roles, return their specific permissions
    const permissions = roleData.permissions;

    // Cache for 5 minutes
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(permissions));

    return permissions;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if user has a specific permission
 * @param {string} userId - Admin user ID
 * @param {string} permissionCode - Permission code (e.g., 'employees.view')
 * @returns {Promise<boolean>} - True if user has permission
 */
export async function hasPermission(userId, permissionCode) {
  try {
    const permissions = await getUserPermissions(userId);
    return permissions.includes(permissionCode);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if user has ANY of the specified permissions
 * @param {string} userId - Admin user ID
 * @param {Array<string>} permissionCodes - Array of permission codes
 * @returns {Promise<boolean>} - True if user has at least one permission
 */
export async function hasAnyPermission(userId, permissionCodes) {
  try {
    const permissions = await getUserPermissions(userId);
    return permissionCodes.some(code => permissions.includes(code));
  } catch (error) {
    console.error('Error checking any permission:', error);
    return false;
  }
}

/**
 * Check if user has ALL of the specified permissions
 * @param {string} userId - Admin user ID
 * @param {Array<string>} permissionCodes - Array of permission codes
 * @returns {Promise<boolean>} - True if user has all permissions
 */
export async function hasAllPermissions(userId, permissionCodes) {
  try {
    const permissions = await getUserPermissions(userId);
    return permissionCodes.every(code => permissions.includes(code));
  } catch (error) {
    console.error('Error checking all permissions:', error);
    return false;
  }
}

/**
 * Invalidate user permission cache (call when roles/permissions change)
 * @param {string} userId - Admin user ID (optional, clears all if not provided)
 */
export async function invalidatePermissionCache(userId = null) {
  try {
    if (userId) {
      // Clear specific user's cache
      const cacheKey = `user:${userId}:permissions`;
      await redis.del(cacheKey);
      console.log(`[PermissionService] Cache cleared for user: ${userId}`);
    } else {
      // Clear all user permission caches
      const keys = await redis.keys('user:*:permissions');
      if (keys && keys.length > 0) {
        await redis.del(...keys);
        console.log(`[PermissionService] Cache cleared for ${keys.length} users`);
      }
    }
  } catch (error) {
    console.error('Error invalidating permission cache:', error);
  }
}

/**
 * Get user's role information
 * @param {string} userId - Admin user ID
 * @returns {Promise<Object>} - Role information
 */
export async function getUserRole(userId) {
  try {
    const cacheKey = `user:${userId}:role`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const roleData = await getUserRoleFromDB(userId);

    if (roleData) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(roleData));
    }

    return roleData;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Check if user is Super Admin
 * @param {string} userId - Admin user ID
 * @returns {Promise<boolean>} - True if Super Admin
 */
export async function isSuperAdmin(userId) {
  try {
    const roleData = await getUserRole(userId);
    return roleData && (roleData.isSystemRole || roleData.legacyRole === 'super_admin');
  } catch (error) {
    console.error('Error checking super admin:', error);
    return false;
  }
}

export default {
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  invalidatePermissionCache,
  getUserRole,
  isSuperAdmin
};
