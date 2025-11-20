/**
 * Admin User Management Routes
 * CRUD operations for admin users (Super Admin only)
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { hashPassword, logAuditAction } from '../utils/auth.js';
import { supabase } from '../../config/supabase.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/authMiddleware.js';
import { invalidatePermissionCache } from '../services/permissionService.js';

const router = express.Router();

// All routes require Super Admin role
router.use(authenticateToken, requireSuperAdmin);

/**
 * GET /api/admin-users
 * List all admin users
 */
router.get('/', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('admin_users')
      .select(`
        id,
        username,
        role,
        role_id,
        full_name,
        email,
        is_active,
        last_login,
        created_at,
        updated_at,
        roles!admin_users_role_id_fkey (
          id,
          name,
          description,
          is_system
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Flatten the role information for easier frontend consumption
    const usersWithRoles = users.map(user => ({
      ...user,
      role_name: user.roles?.name || (user.role === 'super_admin' ? 'Super Admin' : 'Admin'),
      role_description: user.roles?.description
    }));

    return res.status(200).json({
      success: true,
      users: usersWithRoles
    });
  } catch (error) {
    console.error('List admin users error:', error);
    return res.status(500).json({
      error: 'Failed to fetch admin users',
      message: 'An error occurred while fetching admin users'
    });
  }
});

/**
 * GET /api/admin-users/:id
 * Get single admin user by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await supabase
      .from('admin_users')
      .select('id, username, role, full_name, email, is_active, last_login, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Admin user does not exist'
      });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get admin user error:', error);
    return res.status(500).json({
      error: 'Failed to fetch admin user',
      message: 'An error occurred while fetching admin user'
    });
  }
});

/**
 * POST /api/admin-users
 * Create new admin user
 */
router.post('/', [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscore, and hyphen'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character (!@#$%^&*)'),
  body('role')
    .optional()
    .isIn(['super_admin', 'admin']).withMessage('Role must be either super_admin or admin'),
  body('roleId')
    .optional()
    .isUUID().withMessage('Role ID must be a valid UUID'),
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ max: 255 }).withMessage('Full name must not exceed 255 characters'),
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, password, role, roleId, fullName, email } = req.body;

    // Require either role or roleId
    if (!role && !roleId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Either role or roleId must be provided'
      });
    }

    // Validate roleId if provided
    if (roleId) {
      const { data: roleExists, error: roleError } = await supabase
        .from('roles')
        .select('id, name')
        .eq('id', roleId)
        .single();

      if (roleError || !roleExists) {
        return res.status(400).json({
          error: 'Invalid role',
          message: 'The specified role does not exist'
        });
      }
    }

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'Username already exists',
        message: 'An admin user with this username already exists'
      });
    }

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'An admin user with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Build insert data
    const insertData = {
      username,
      password_hash: passwordHash,
      full_name: fullName,
      email,
      is_active: true
    };

    // Add role or roleId based on what was provided
    if (roleId) {
      insertData.role_id = roleId;
    } else if (role) {
      insertData.role = role;
    }

    // Create new admin user
    const { data: newUser, error } = await supabase
      .from('admin_users')
      .insert(insertData)
      .select('id, username, role, role_id, full_name, email, is_active, created_at')
      .single();

    if (error) {
      throw error;
    }

    // Log admin creation
    await logAuditAction(req.user.id, 'CREATE_ADMIN_USER', {
      resourceType: 'admin_user',
      resourceId: newUser.id,
      metadata: {
        username: newUser.username,
        role: newUser.role,
        createdBy: req.user.username
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Create admin user error:', error);
    return res.status(500).json({
      error: 'Failed to create admin user',
      message: 'An error occurred while creating admin user'
    });
  }
});

/**
 * PUT /api/admin-users/:id
 * Update admin user details
 */
router.put('/:id', [
  body('role')
    .optional()
    .isIn(['super_admin', 'admin']).withMessage('Role must be either super_admin or admin'),
  body('roleId')
    .optional()
    .isUUID().withMessage('Role ID must be a valid UUID'),
  body('fullName')
    .optional()
    .trim()
    .notEmpty().withMessage('Full name cannot be empty')
    .isLength({ max: 255 }).withMessage('Full name must not exceed 255 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { role, roleId, fullName, email, isActive } = req.body;

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Admin user does not exist'
      });
    }

    // Validate roleId if provided
    if (roleId !== undefined) {
      const { data: roleExists, error: roleError } = await supabase
        .from('roles')
        .select('id, name, is_system')
        .eq('id', roleId)
        .single();

      if (roleError || !roleExists) {
        return res.status(400).json({
          error: 'Invalid role',
          message: 'The specified role does not exist'
        });
      }

      // Prevent demoting self from Super Admin if you're the last super admin
      if (id === req.user.id && existingUser.role_id) {
        const { data: currentRole } = await supabase
          .from('roles')
          .select('name')
          .eq('id', existingUser.role_id)
          .single();

        if (currentRole && currentRole.name === 'Super Admin' && roleExists.name !== 'Super Admin') {
          // Check if this is the last active Super Admin
          const { data: superAdminRole } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'Super Admin')
            .single();

          if (superAdminRole) {
            const { data: superAdmins } = await supabase
              .from('admin_users')
              .select('id')
              .eq('role_id', superAdminRole.id)
              .eq('is_active', true);

            if (superAdmins && superAdmins.length === 1) {
              return res.status(400).json({
                error: 'Invalid operation',
                message: 'Cannot demote the last active Super Admin'
              });
            }
          }
        }
      }
    }

    // Prevent updating own status to inactive
    if (id === req.user.id && isActive === false) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'You cannot deactivate your own account'
      });
    }

    // Prevent demoting self from super_admin if you're the last super_admin (legacy role column)
    if (id === req.user.id && role && role !== 'super_admin') {
      const { data: superAdmins } = await supabase
        .from('admin_users')
        .select('id')
        .eq('role', 'super_admin')
        .eq('is_active', true);

      if (superAdmins && superAdmins.length === 1) {
        return res.status(400).json({
          error: 'Invalid operation',
          message: 'Cannot demote the last active Super Admin'
        });
      }
    }

    // Check if email is being changed and if it already exists
    if (email && email !== existingUser.email) {
      const { data: emailExists } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', email)
        .neq('id', id)
        .single();

      if (emailExists) {
        return res.status(409).json({
          error: 'Email already exists',
          message: 'Another admin user with this email already exists'
        });
      }
    }

    // Build update object
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (role !== undefined) updateData.role = role;
    if (roleId !== undefined) updateData.role_id = roleId;
    if (fullName !== undefined) updateData.full_name = fullName;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.is_active = isActive;

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('admin_users')
      .update(updateData)
      .eq('id', id)
      .select('id, username, role, full_name, email, is_active, updated_at')
      .single();

    if (updateError) {
      throw updateError;
    }

    // Invalidate permission cache if role was changed
    if (role !== undefined || roleId !== undefined) {
      await invalidatePermissionCache(id);
    }

    // Log admin update
    await logAuditAction(req.user.id, 'UPDATE_ADMIN_USER', {
      resourceType: 'admin_user',
      resourceId: id,
      metadata: {
        username: existingUser.username,
        changes: updateData,
        updatedBy: req.user.username
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(200).json({
      success: true,
      message: 'Admin user updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update admin user error:', error);
    return res.status(500).json({
      error: 'Failed to update admin user',
      message: 'An error occurred while updating admin user'
    });
  }
});

/**
 * DELETE /api/admin-users/:id
 * Deactivate admin user (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Admin user does not exist'
      });
    }

    // Prevent deleting own account
    if (id === req.user.id) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'You cannot delete your own account'
      });
    }

    // Prevent deleting last super_admin
    if (existingUser.role === 'super_admin') {
      const { data: superAdmins } = await supabase
        .from('admin_users')
        .select('id')
        .eq('role', 'super_admin')
        .eq('is_active', true);

      if (superAdmins && superAdmins.length === 1) {
        return res.status(400).json({
          error: 'Invalid operation',
          message: 'Cannot delete the last active Super Admin'
        });
      }
    }

    // Soft delete (deactivate)
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Log admin deletion
    await logAuditAction(req.user.id, 'DELETE_ADMIN_USER', {
      resourceType: 'admin_user',
      resourceId: id,
      metadata: {
        username: existingUser.username,
        role: existingUser.role,
        deletedBy: req.user.username
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(200).json({
      success: true,
      message: 'Admin user deactivated successfully'
    });
  } catch (error) {
    console.error('Delete admin user error:', error);
    return res.status(500).json({
      error: 'Failed to delete admin user',
      message: 'An error occurred while deleting admin user'
    });
  }
});

/**
 * GET /api/admin-users/audit-logs/:userId
 * Get audit logs for a specific user
 */
router.get('/audit-logs/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const { data: logs, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .eq('admin_user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        limit,
        offset,
        count: logs.length
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return res.status(500).json({
      error: 'Failed to fetch audit logs',
      message: 'An error occurred while fetching audit logs'
    });
  }
});

export default router;
