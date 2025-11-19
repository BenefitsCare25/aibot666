/**
 * Authentication Routes
 * Handles admin login, logout, password management
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import {
  hashPassword,
  comparePassword,
  generateToken,
  createAdminSession,
  deleteSession,
  logAuditAction
} from '../utils/auth.js';
import { supabase } from '../../config/supabase.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Admin login with username and password
 */
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
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

    const { username, password } = req.body;

    // Find user by username
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      // Log failed login attempt
      await logAuditAction(null, 'LOGIN_FAILED', {
        metadata: { username, reason: 'user_not_found' },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Check if account is active
    if (!user.is_active) {
      await logAuditAction(user.id, 'LOGIN_FAILED', {
        metadata: { username, reason: 'account_disabled' },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      return res.status(403).json({
        error: 'Account disabled',
        message: 'Your account has been deactivated. Please contact a Super Admin.'
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      await logAuditAction(user.id, 'LOGIN_FAILED', {
        metadata: { username, reason: 'invalid_password' },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };
    const token = generateToken(tokenPayload);

    // Create session
    const session = await createAdminSession(user.id, token, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Add sessionId to token payload for future requests
    const tokenWithSession = generateToken({
      ...tokenPayload,
      sessionId: session.id
    });

    // Update last login timestamp
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Log successful login
    await logAuditAction(user.id, 'LOGIN_SUCCESS', {
      metadata: { username },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Set HTTP-only cookie (cross-domain compatible)
    res.cookie('adminToken', tokenWithSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-domain in production
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return user data and token
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: tokenWithSession,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

/**
 * POST /api/auth/logout
 * Admin logout - invalidate session
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Delete session
    await deleteSession(req.user.id);

    // Log logout
    await logAuditAction(req.user.id, 'LOGOUT', {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Clear cookie
    res.clearCookie('adminToken');

    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      error: 'Logout failed',
      message: 'An error occurred during logout'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get user info error:', error);
    return res.status(500).json({
      error: 'Failed to get user info',
      message: 'An error occurred while fetching user information'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Generate new token with same payload
    const tokenPayload = {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role
    };
    const newToken = generateToken(tokenPayload);

    // Set new cookie (cross-domain compatible)
    res.cookie('adminToken', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-domain in production
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      error: 'Token refresh failed',
      message: 'An error occurred while refreshing token'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change own password (requires current password)
 */
router.post('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('New password must contain at least one number')
    .matches(/[!@#$%^&*]/).withMessage('New password must contain at least one special character (!@#$%^&*)')
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

    const { currentPassword, newPassword } = req.body;

    // Get user with password hash
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('password_hash')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account does not exist'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      await logAuditAction(req.user.id, 'CHANGE_PASSWORD_FAILED', {
        metadata: { reason: 'invalid_current_password' },
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      return res.status(401).json({
        error: 'Invalid password',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) {
      throw updateError;
    }

    // Log password change
    await logAuditAction(req.user.id, 'CHANGE_PASSWORD_SUCCESS', {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Invalidate all sessions (force re-login with new password)
    await deleteSession(req.user.id);
    res.clearCookie('adminToken');

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please login again with your new password.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      error: 'Password change failed',
      message: 'An error occurred while changing password'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Super Admin resets another admin's password (admin-assisted)
 */
router.post('/reset-password', [
  authenticateToken,
  requireSuperAdmin,
  body('userId').isUUID().withMessage('Valid user ID is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('New password must contain at least one number')
    .matches(/[!@#$%^&*]/).withMessage('New password must contain at least one special character (!@#$%^&*)')
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

    const { userId, newPassword } = req.body;

    // Check if target user exists
    const { data: targetUser, error } = await supabase
      .from('admin_users')
      .select('id, username, role')
      .eq('id', userId)
      .single();

    if (error || !targetUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Target user does not exist'
      });
    }

    // Prevent resetting own password through this endpoint
    if (targetUser.id === req.user.id) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Use /change-password to change your own password'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // Log password reset
    await logAuditAction(req.user.id, 'RESET_PASSWORD', {
      resourceType: 'admin_user',
      resourceId: userId,
      metadata: {
        targetUsername: targetUser.username,
        targetRole: targetUser.role
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Invalidate all sessions for target user (force re-login)
    await deleteSession(userId);

    return res.status(200).json({
      success: true,
      message: `Password reset successfully for user ${targetUser.username}`
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      error: 'Password reset failed',
      message: 'An error occurred while resetting password'
    });
  }
});

export default router;

/**
 * GET /api/auth/me/permissions
 * Get current user's permissions
 */
router.get('/me/permissions', authenticateToken, async (req, res) => {
  try {
    // Import permission service dynamically to avoid circular dependencies
    const { getUserPermissions, getUserRole } = await import('../services/permissionService.js');

    const [permissions, roleData] = await Promise.all([
      getUserPermissions(req.user.id),
      getUserRole(req.user.id)
    ]);

    return res.status(200).json({
      success: true,
      permissions: permissions,
      role: roleData
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    return res.status(500).json({
      error: 'Failed to fetch permissions',
      message: 'An error occurred while fetching user permissions'
    });
  }
});
