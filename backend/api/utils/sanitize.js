/**
 * Input Sanitization Utilities
 * Prevents injection attacks in search/filter parameters
 */

const MAX_SEARCH_LENGTH = 200;

/**
 * Sanitize search parameter for use in Supabase ilike queries
 * Strips characters that could be used for SQL/pattern injection
 * @param {string} input - Raw search input
 * @returns {string} - Sanitized search string
 */
export function sanitizeSearchParam(input) {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/[%_\\,.()"';]/g, '')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

export default { sanitizeSearchParam };
