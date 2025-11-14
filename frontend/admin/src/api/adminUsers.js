/**
 * Admin Users API
 * Manages admin user accounts (Super Admin only)
 */

import apiClient from './client.js';

/**
 * Get all admin users
 * @returns {Promise<{users}>}
 */
export async function getAllAdminUsers() {
  const response = await apiClient.get('/api/admin-users');
  return response;
}

/**
 * Get single admin user by ID
 * @param {string} userId
 * @returns {Promise<{user}>}
 */
export async function getAdminUser(userId) {
  const response = await apiClient.get(`/api/admin-users/${userId}`);
  return response;
}

/**
 * Create new admin user
 * @param {object} userData
 * @param {string} userData.username
 * @param {string} userData.password
 * @param {string} userData.role - 'super_admin' or 'admin'
 * @param {string} userData.fullName
 * @param {string} userData.email
 * @returns {Promise<{user}>}
 */
export async function createAdminUser(userData) {
  const response = await apiClient.post('/api/admin-users', userData);
  return response;
}

/**
 * Update admin user details
 * @param {string} userId
 * @param {object} updates
 * @returns {Promise<{user}>}
 */
export async function updateAdminUser(userId, updates) {
  const response = await apiClient.put(`/api/admin-users/${userId}`, updates);
  return response;
}

/**
 * Deactivate admin user (soft delete)
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function deleteAdminUser(userId) {
  const response = await apiClient.delete(`/api/admin-users/${userId}`);
  return response;
}

/**
 * Get audit logs for a user
 * @param {string} userId
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<{logs, pagination}>}
 */
export async function getAuditLogs(userId, limit = 50, offset = 0) {
  const response = await apiClient.get(`/api/admin-users/audit-logs/${userId}`, {
    params: { limit, offset }
  });
  return response;
}
