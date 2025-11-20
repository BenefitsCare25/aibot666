/**
 * Role Management Routes
 * CRUD operations for roles and permissions (Super Admin only)
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../../config/supabase.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/authMiddleware.js';
import { logAuditAction } from '../utils/auth.js';
import { invalidatePermissionCache } from '../services/permissionService.js';

const router = express.Router();

// All routes require Super Admin role
router.use(authenticateToken, requireSuperAdmin);

/**
 * GET /api/roles
 * List all roles with permission counts
 */
router.get('/', async (req, res) => {
  try {
    // Get all roles
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name, description, is_system, created_at, updated_at')
      .order('is_system', { ascending: false }) // Super Admin first
      .order('created_at', { ascending: false });

    if (rolesError) {
      throw rolesError;
    }

    // Get permission counts for each role
    const rolesWithCounts = await Promise.all(
      roles.map(async (role) => {
        const { count, error: countError } = await supabase
          .from('role_permissions')
          .select('id', { count: 'exact', head: true })
          .eq('role_id', role.id);

        if (countError) {
          console.error('Error counting permissions for role:', role.name, countError);
        }

        // Get count of users with this role
        const { count: userCount, error: userCountError } = await supabase
          .from('admin_users')
          .select('id', { count: 'exact', head: true })
          .eq('role_id', role.id);

        if (userCountError) {
          console.error('Error counting users for role:', role.name, userCountError);
        }

        return {
          ...role,
          permission_count: count || 0,
          user_count: userCount || 0
        };
      })
    );

    return res.status(200).json({
      success: true,
      roles: rolesWithCounts
    });
  } catch (error) {
    console.error('List roles error:', error);
    return res.status(500).json({
      error: 'Failed to fetch roles',
      message: 'An error occurred while fetching roles'
    });
  }
});

/**
 * GET /api/roles/all-permissions
 * Get all available permissions (for permission selection UI)
 */
router.get('/all-permissions', async (req, res) => {
  try {
    const { data: permissions, error } = await supabase
      .from('permissions')
      .select('id, code, resource, action, description')
      .order('resource', { ascending: true })
      .order('action', { ascending: true });

    if (error) {
      throw error;
    }

    // Group permissions by resource for easier UI rendering
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      permissions: permissions,
      grouped: grouped
    });
  } catch (error) {
    console.error('Fetch permissions error:', error);
    return res.status(500).json({
      error: 'Failed to fetch permissions',
      message: 'An error occurred while fetching permissions'
    });
  }
});

/**
 * GET /api/roles/:id
 * Get single role with its permissions
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get role details
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, name, description, is_system, created_at, updated_at')
      .eq('id', id)
      .single();

    if (roleError || !role) {
      return res.status(404).json({
        error: 'Role not found',
        message: 'Role does not exist'
      });
    }

    // Get role's permissions
    const { data: rolePermissions, error: permError } = await supabase
      .from('role_permissions')
      .select(`
        permission_id,
        permissions (
          id,
          code,
          resource,
          action,
          description
        )
      `)
      .eq('role_id', id);

    if (permError) {
      throw permError;
    }

    // Extract permission IDs and details
    const permissions = rolePermissions.map(rp => rp.permissions);
    const permissionIds = permissions.map(p => p.id);

    return res.status(200).json({
      success: true,
      role: {
        ...role,
        permissions: permissions,
        permission_ids: permissionIds
      }
    });
  } catch (error) {
    console.error('Get role error:', error);
    return res.status(500).json({
      error: 'Failed to fetch role',
      message: 'An error occurred while fetching role'
    });
  }
});

/**
 * POST /api/roles
 * Create new role with permissions
 */
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Role name must be 2-100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('Role name can only contain letters, numbers, spaces, hyphens, and underscores'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
  body('permissions')
    .isArray().withMessage('Permissions must be an array')
    .notEmpty().withMessage('At least one permission must be selected')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    const { name, description, permissions } = req.body;

    // Check if role name already exists
    const { data: existingRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', name)
      .single();

    if (existingRole) {
      return res.status(400).json({
        error: 'Role already exists',
        message: `A role with the name "${name}" already exists`
      });
    }

    // Create role
    const { data: newRole, error: roleError } = await supabase
      .from('roles')
      .insert({
        name: name,
        description: description || null,
        is_system: false,
        created_by: req.user.id
      })
      .select()
      .single();

    if (roleError) {
      throw roleError;
    }

    // Validate permission IDs exist
    const { data: validPermissions, error: validError } = await supabase
      .from('permissions')
      .select('id')
      .in('id', permissions);

    if (validError) {
      throw validError;
    }

    if (validPermissions.length !== permissions.length) {
      // Rollback: Delete the created role
      await supabase.from('roles').delete().eq('id', newRole.id);

      return res.status(400).json({
        error: 'Invalid permissions',
        message: 'One or more permission IDs are invalid'
      });
    }

    // Assign permissions to role
    const rolePermissions = permissions.map(permissionId => ({
      role_id: newRole.id,
      permission_id: permissionId
    }));

    const { error: assignError } = await supabase
      .from('role_permissions')
      .insert(rolePermissions);

    if (assignError) {
      // Rollback: Delete the created role
      await supabase.from('roles').delete().eq('id', newRole.id);
      throw assignError;
    }

    // Log audit action
    await logAuditAction(
      req.user.id,
      'role_created',
      'role',
      newRole.id,
      {
        role_name: name,
        permission_count: permissions.length,
        permissions: permissions
      },
      req.ip,
      req.get('user-agent')
    );

    // Log to role_audit_logs
    await supabase.from('role_audit_logs').insert({
      role_id: newRole.id,
      role_name: name,
      action: 'created',
      changed_by: req.user.id,
      changes: {
        permissions_added: permissions,
        description: description
      },
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    return res.status(201).json({
      success: true,
      message: 'Role created successfully',
      role: newRole
    });
  } catch (error) {
    console.error('Create role error:', error);
    return res.status(500).json({
      error: 'Failed to create role',
      message: 'An error occurred while creating role'
    });
  }
});

/**
 * PUT /api/roles/:id
 * Update role details and permissions
 */
router.put('/:id', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Role name must be 2-100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('Role name can only contain letters, numbers, spaces, hyphens, and underscores'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
  body('permissions')
    .optional()
    .isArray().withMessage('Permissions must be an array')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }

    // Check if role exists
    const { data: existingRole, error: fetchError } = await supabase
      .from('roles')
      .select('id, name, is_system')
      .eq('id', id)
      .single();

    if (fetchError || !existingRole) {
      return res.status(404).json({
        error: 'Role not found',
        message: 'Role does not exist'
      });
    }

    // Prevent modifying system roles
    if (existingRole.is_system) {
      return res.status(403).json({
        error: 'Cannot modify system role',
        message: 'System roles (Super Admin) cannot be modified'
      });
    }

    // Check if new name conflicts with existing role
    if (name && name !== existingRole.name) {
      const { data: nameConflict } = await supabase
        .from('roles')
        .select('id')
        .eq('name', name)
        .neq('id', id)
        .single();

      if (nameConflict) {
        return res.status(400).json({
          error: 'Role name already exists',
          message: `A role with the name "${name}" already exists`
        });
      }
    }

    const changes = {};

    // Update role details
    const updateData = {};
    if (name !== undefined) {
      updateData.name = name;
      changes.name_changed = { from: existingRole.name, to: name };
    }
    if (description !== undefined) {
      updateData.description = description;
      changes.description_changed = true;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('roles')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }
    }

    // Update permissions if provided
    if (permissions !== undefined) {
      // Validate permission IDs
      const { data: validPermissions, error: validError } = await supabase
        .from('permissions')
        .select('id')
        .in('id', permissions);

      if (validError) {
        throw validError;
      }

      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({
          error: 'Invalid permissions',
          message: 'One or more permission IDs are invalid'
        });
      }

      // Get current permissions
      const { data: currentPerms } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', id);

      const currentPermIds = currentPerms.map(p => p.permission_id);

      // Calculate added and removed permissions
      const addedPerms = permissions.filter(p => !currentPermIds.includes(p));
      const removedPerms = currentPermIds.filter(p => !permissions.includes(p));

      // Delete all existing permissions
      const { error: deleteError } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Insert new permissions
      if (permissions.length > 0) {
        const rolePermissions = permissions.map(permissionId => ({
          role_id: id,
          permission_id: permissionId
        }));

        const { error: insertError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions);

        if (insertError) {
          throw insertError;
        }
      }

      changes.permissions_changed = {
        added: addedPerms,
        removed: removedPerms,
        total: permissions.length
      };
    }

    // Log audit action
    await logAuditAction(
      req.user.id,
      'role_updated',
      'role',
      id,
      changes,
      req.ip,
      req.get('user-agent')
    );

    // Log to role_audit_logs
    await supabase.from('role_audit_logs').insert({
      role_id: id,
      role_name: name || existingRole.name,
      action: 'updated',
      changed_by: req.user.id,
      changes: changes,
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    // Invalidate permission cache for all users with this role
    if (permissions !== undefined) {
      const { data: usersWithRole } = await supabase
        .from('admin_users')
        .select('id')
        .eq('role_id', id);

      if (usersWithRole && usersWithRole.length > 0) {
        for (const user of usersWithRole) {
          await invalidatePermissionCache(user.id);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Role updated successfully'
    });
  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json({
      error: 'Failed to update role',
      message: 'An error occurred while updating role'
    });
  }
});

/**
 * DELETE /api/roles/:id
 * Delete a role (prevent if users are assigned or if system role)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists
    const { data: role, error: fetchError } = await supabase
      .from('roles')
      .select('id, name, is_system')
      .eq('id', id)
      .single();

    if (fetchError || !role) {
      return res.status(404).json({
        error: 'Role not found',
        message: 'Role does not exist'
      });
    }

    // Prevent deleting system roles
    if (role.is_system) {
      return res.status(403).json({
        error: 'Cannot delete system role',
        message: 'System roles (Super Admin) cannot be deleted'
      });
    }

    // Check if any users are assigned to this role
    const { data: usersWithRole, error: userError } = await supabase
      .from('admin_users')
      .select('id, username')
      .eq('role_id', id);

    if (userError) {
      throw userError;
    }

    if (usersWithRole && usersWithRole.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete role',
        message: `This role is assigned to ${usersWithRole.length} user(s). Please reassign them before deleting.`,
        affected_users: usersWithRole.map(u => u.username)
      });
    }

    // Delete role (cascade will delete role_permissions)
    const { error: deleteError } = await supabase
      .from('roles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Log audit action
    await logAuditAction(
      req.user.id,
      'role_deleted',
      'role',
      id,
      { role_name: role.name },
      req.ip,
      req.get('user-agent')
    );

    // Log to role_audit_logs
    await supabase.from('role_audit_logs').insert({
      role_id: null, // Role is deleted
      role_name: role.name,
      action: 'deleted',
      changed_by: req.user.id,
      changes: { deleted_role_id: id },
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    return res.status(200).json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Delete role error:', error);
    return res.status(500).json({
      error: 'Failed to delete role',
      message: 'An error occurred while deleting role'
    });
  }
});

/**
 * GET /api/roles/:id/audit-logs
 * Get audit logs for a specific role
 */
router.get('/:id/audit-logs', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: logs, error } = await supabase
      .from('role_audit_logs')
      .select(`
        id,
        role_name,
        action,
        changes,
        ip_address,
        created_at,
        admin_users!role_audit_logs_changed_by_fkey (
          username,
          full_name
        )
      `)
      .eq('role_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      logs: logs
    });
  } catch (error) {
    console.error('Fetch role audit logs error:', error);
    return res.status(500).json({
      error: 'Failed to fetch audit logs',
      message: 'An error occurred while fetching audit logs'
    });
  }
});

export default router;
