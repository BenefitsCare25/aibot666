import apiClient from './client';

export const aiSettingsApi = {
  /**
   * Get available AI models with pricing information
   * @returns {Promise} Response with models array
   */
  getModels: () => {
    return apiClient.get('/ai-settings/models');
  },

  /**
   * Get AI settings for a specific company
   * @param {string} companyId - Company UUID
   * @returns {Promise} Response with company settings
   */
  getCompanySettings: (companyId) => {
    return apiClient.get(`/ai-settings/companies/${companyId}`);
  },

  /**
   * Update AI settings for a company
   * @param {string} companyId - Company UUID
   * @param {Object} settings - AI settings object
   * @returns {Promise} Response with updated settings
   */
  updateCompanySettings: (companyId, settings) => {
    return apiClient.put(`/ai-settings/companies/${companyId}`, { settings });
  },

  /**
   * Test AI configuration with a sample query
   * @param {string} companyId - Company UUID
   * @param {string} testQuery - Sample query to test
   * @param {Object} settings - AI settings to test
   * @returns {Promise} Response with test results
   */
  testConfiguration: (companyId, testQuery, settings) => {
    return apiClient.post('/ai-settings/test', {
      companyId,
      testQuery,
      settings
    });
  },

  /**
   * Reset AI settings to global defaults
   * @param {string} companyId - Company UUID
   * @returns {Promise} Response with reset settings
   */
  resetSettings: (companyId) => {
    return apiClient.post(`/ai-settings/reset/${companyId}`);
  },

  /**
   * Get global default AI settings
   * @returns {Promise} Response with default settings
   */
  getDefaults: () => {
    return apiClient.get('/ai-settings/defaults');
  }
};

export default aiSettingsApi;
