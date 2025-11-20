/**
 * Roles API
 * Manages role and permission operations
 */

import apiClient from './client.js';

/**
 * Get all roles
 * @returns {Promise<{roles}>}
 */
export async function getAllRoles() {
  const response = await apiClient.get('/api/roles');
  return response;
}

/**
 * Get single role by ID with permissions
 * @param {string} roleId
 * @returns {Promise<{role}>}
 */
export async function getRole(roleId) {
  const response = await apiClient.get(`/api/roles/${roleId}`);
  return response;
}

/**
 * Create new role
 * @param {object} roleData
 * @param {string} roleData.name
 * @param {string} roleData.description
 * @param {string[]} roleData.permissions - Array of permission IDs
 * @returns {Promise<{role}>}
 */
export async function createRole(roleData) {
  const response = await apiClient.post('/api/roles', roleData);
  return response;
}

/**
 * Update role
 * @param {string} roleId
 * @param {object} updates
 * @returns {Promise<void>}
 */
export async function updateRole(roleId, updates) {
  const response = await apiClient.put(`/api/roles/${roleId}`, updates);
  return response;
}

/**
 * Delete role
 * @param {string} roleId
 * @returns {Promise<void>}
 */
export async function deleteRole(roleId) {
  const response = await apiClient.delete(`/api/roles/${roleId}`);
  return response;
}

/**
 * Get all available permissions
 * @returns {Promise<{permissions, grouped}>}
 */
export async function getAllPermissions() {
  const response = await apiClient.get('/api/roles/all-permissions');
  return response;
}
