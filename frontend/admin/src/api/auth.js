/**
 * Authentication API
 * Handles login, logout, password management
 */

import apiClient from './client.js';

/**
 * Login with username and password
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{user, token}>}
 */
export async function login(username, password) {
  const response = await apiClient.post('/api/auth/login', {
    username,
    password
  });
  return response;
}

/**
 * Logout current user
 * @returns {Promise<void>}
 */
export async function logout() {
  const response = await apiClient.post('/api/auth/logout');
  return response;
}

/**
 * Get current authenticated user
 * @returns {Promise<{user}>}
 */
export async function getCurrentUser() {
  const response = await apiClient.get('/api/auth/me');
  return response;
}

/**
 * Refresh JWT token
 * @returns {Promise<{token}>}
 */
export async function refreshToken() {
  const response = await apiClient.post('/api/auth/refresh');
  return response;
}

/**
 * Change own password
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
export async function changePassword(currentPassword, newPassword) {
  const response = await apiClient.post('/api/auth/change-password', {
    currentPassword,
    newPassword
  });
  return response;
}

/**
 * Reset another user's password (Super Admin only)
 * @param {string} userId
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
export async function resetPassword(userId, newPassword) {
  const response = await apiClient.post('/api/auth/reset-password', {
    userId,
    newPassword
  });
  return response;
}
