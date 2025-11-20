/**
 * Authentication Utilities
 * Handles password hashing, JWT token generation, and session management
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabase } from '../../config/supabase.js';
import Redis from 'ioredis';

// Create Redis client for admin sessions
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Configuration
const SALT_ROUNDS = 10;
export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
export const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
export const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30; // minutes

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare plain text password with hashed password
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if passwords match
 */
export async function comparePassword(password, hash) {
  try {
    const match = await bcrypt.compare(password, hash);
    return match;
  } catch (error) {
    console.error('Error comparing password:', error);
    throw new Error('Failed to verify password');
  }
}

/**
 * Generate JWT token for admin user
 * @param {object} payload - Token payload (user info)
 * @param {string} expiresIn - Token expiration time
 * @returns {string} - JWT token
 */
export function generateToken(payload, expiresIn = JWT_EXPIRY) {
  try {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn });
    return token;
  } catch (error) {
    console.error('Error generating token:', error);
    throw new Error('Failed to generate token');
  }
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object} - Decoded token payload
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      console.error('Error verifying token:', error);
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Create admin session in database and Redis
 * @param {string} adminUserId - Admin user ID
 * @param {string} token - JWT token
 * @param {object} metadata - Additional session metadata (ip, userAgent)
 * @returns {Promise<object>} - Session data
 */
export async function createAdminSession(adminUserId, token, metadata = {}) {
  try {
    // Hash token for storage (security best practice)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Calculate expiration time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store session in database
    const { data: session, error } = await supabase
      .from('admin_sessions')
      .insert({
        admin_user_id: adminUserId,
        token_hash: tokenHash,
        last_activity: new Date().toISOString(),
        ip_address: metadata.ip || null,
        user_agent: metadata.userAgent || null,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating admin session:', error);
      throw error;
    }

    // Store session in Redis for quick access
    const redisKey = `admin_session:${adminUserId}`;
    await redis.setex(
      redisKey,
      SESSION_TIMEOUT * 60, // Convert minutes to seconds
      JSON.stringify({
        sessionId: session.id,
        tokenHash,
        lastActivity: new Date().toISOString()
      })
    );

    return session;
  } catch (error) {
    console.error('Error creating admin session:', error);
    throw new Error('Failed to create session');
  }
}

/**
 * Update session last activity timestamp
 * @param {string} adminUserId - Admin user ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function updateSessionActivity(adminUserId, sessionId) {
  try {
    const now = new Date().toISOString();

    // Update database
    await supabase
      .from('admin_sessions')
      .update({ last_activity: now })
      .eq('id', sessionId)
      .eq('admin_user_id', adminUserId);

    // Update Redis with extended TTL
    const redisKey = `admin_session:${adminUserId}`;
    const sessionData = await redis.get(redisKey);

    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      parsed.lastActivity = now;

      await redis.setex(
        redisKey,
        SESSION_TIMEOUT * 60,
        JSON.stringify(parsed)
      );
    }
  } catch (error) {
    console.error('Error updating session activity:', error);
    // Don't throw - session activity update is non-critical
  }
}

/**
 * Validate if session is still active (not expired)
 * @param {string} adminUserId - Admin user ID
 * @returns {Promise<boolean>} - True if session is active
 */
export async function validateSession(adminUserId) {
  try {
    // Check Redis first (faster)
    const redisKey = `admin_session:${adminUserId}`;
    const sessionData = await redis.get(redisKey);

    if (!sessionData) {
      return false;
    }

    const session = JSON.parse(sessionData);
    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    const minutesSinceActivity = (now - lastActivity) / (1000 * 60);

    // Check if session has timed out
    if (minutesSinceActivity > SESSION_TIMEOUT) {
      await deleteSession(adminUserId);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating session:', error);
    return false;
  }
}

/**
 * Delete admin session (logout)
 * @param {string} adminUserId - Admin user ID
 * @param {string} sessionId - Optional session ID
 * @returns {Promise<void>}
 */
export async function deleteSession(adminUserId, sessionId = null) {
  try {
    // Delete from Redis
    const redisKey = `admin_session:${adminUserId}`;
    await redis.del(redisKey);

    // Delete from database
    if (sessionId) {
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('admin_user_id', adminUserId);
    } else {
      // Delete all sessions for this user
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('admin_user_id', adminUserId);
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    throw new Error('Failed to delete session');
  }
}

/**
 * Clean up expired sessions (should be run periodically)
 * @returns {Promise<void>}
 */
export async function cleanupExpiredSessions() {
  try {
    const now = new Date().toISOString();

    await supabase
      .from('admin_sessions')
      .delete()
      .lt('expires_at', now);

  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}

/**
 * Log admin action for audit trail
 * @param {string} adminUserId - Admin user ID
 * @param {string} action - Action performed
 * @param {object} details - Additional details
 * @returns {Promise<void>}
 */
export async function logAuditAction(adminUserId, action, details = {}) {
  try {
    await supabase
      .from('admin_audit_logs')
      .insert({
        admin_user_id: adminUserId,
        action,
        resource_type: details.resourceType || null,
        resource_id: details.resourceId || null,
        details: details.metadata || {},
        ip_address: details.ip || null,
        user_agent: details.userAgent || null
      });
  } catch (error) {
    console.error('Error logging audit action:', error);
    // Don't throw - audit logging is non-critical
  }
}
