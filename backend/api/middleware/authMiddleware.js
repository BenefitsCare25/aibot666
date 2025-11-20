/**
 * Authentication Middleware
 * Provides JWT authentication and role-based authorization
 */

import { verifyToken, validateSession, updateSessionActivity, logAuditAction } from '../utils/auth.js';
import { supabase } from '../../config/supabase.js';

/**
 * Middleware to authenticate admin user via JWT token
 * Checks for token in cookies or Authorization header
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
export async function authenticateToken(req, res, next) {
  try {
    // Get token from cookie or Authorization header
    let token = null;

    // Check cookie first
    if (req.cookies && req.cookies.adminToken) {
      token = req.cookies.adminToken;
    }

    // Check Authorization header as fallback
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      // Log authentication attempt from IP
      console.warn(`[Auth] Unauthenticated request to ${req.path} from IP: ${req.ip}`);

      return res.status(401).json({
        error: 'Authentication required',
        message: 'No authentication token provided'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid token',
        message: error.message
      });
    }

    // Validate session is still active
    const isSessionActive = await validateSession(decoded.userId);
    if (!isSessionActive) {
      return res.status(401).json({
        error: 'Session expired',
        message: 'Your session has expired. Please login again.'
      });
    }

    // Fetch user from database to ensure they still exist and are active
    const { data: user, error } = await supabase
      .from('admin_users')
      .select(`
        id,
        username,
        role,
        role_id,
        full_name,
        email,
        is_active,
        roles!admin_users_role_id_fkey (
          id,
          name,
          description
        )
      `)
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Admin user does not exist'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account disabled',
        message: 'Your account has been deactivated. Please contact a Super Admin.'
      });
    }

    // Attach user info to request object
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      roleId: user.role_id,
      roleName: user.roles?.name || (user.role === 'super_admin' ? 'Super Admin' : 'Admin'),
      fullName: user.full_name,
      email: user.email
    };

    // Update session activity (async, don't wait)
    if (decoded.sessionId) {
      updateSessionActivity(user.id, decoded.sessionId).catch(err => {
        console.error('Failed to update session activity:', err);
      });
    }

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
}

/**
 * Middleware to require Super Admin role
 * Must be used after authenticateToken middleware
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }

  if (req.user.role !== 'super_admin') {
    // Log unauthorized access attempt
    logAuditAction(req.user.id, 'UNAUTHORIZED_ACCESS_ATTEMPT', {
      resourceType: 'super_admin_route',
      resourceId: req.path,
      metadata: { userRole: req.user.role },
      ip: req.ip,
      userAgent: req.get('user-agent')
    }).catch(err => console.error('Failed to log audit action:', err));

    return res.status(403).json({
      error: 'Forbidden',
      message: 'This action requires Super Admin privileges'
    });
  }

  next();
}

/**
 * Middleware to require any authenticated admin
 * Alias for authenticateToken for clarity in route definitions
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
export function requireAuth(req, res, next) {
  return authenticateToken(req, res, next);
}

/**
 * Middleware to check if user has specific permission
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {function} - Express middleware function
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't block if no token
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
export async function optionalAuth(req, res, next) {
  try {
    // Get token from cookie or Authorization header
    let token = null;

    if (req.cookies && req.cookies.adminToken) {
      token = req.cookies.adminToken;
    }

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // No token - continue without authentication
    if (!token) {
      return next();
    }

    // Try to verify token but don't fail if invalid
    try {
      const decoded = verifyToken(token);
      const isSessionActive = await validateSession(decoded.userId);

      if (isSessionActive) {
        const { data: user } = await supabase
          .from('admin_users')
          .select(`
            id,
            username,
            role,
            role_id,
            full_name,
            email,
            is_active,
            roles!admin_users_role_id_fkey (
              id,
              name,
              description
            )
          `)
          .eq('id', decoded.userId)
          .single();

        if (user && user.is_active) {
          req.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            roleId: user.role_id,
            roleName: user.roles?.name || (user.role === 'super_admin' ? 'Super Admin' : 'Admin'),
            fullName: user.full_name,
            email: user.email
          };
        }
      }
    } catch (error) {
      // Invalid token - just continue without user
      console.debug('Optional auth: Invalid token, continuing without user');
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even on error
  }
}
