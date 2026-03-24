/**
 * Standardized API Response Utilities
 */

export function successResponse(data, message) {
  return {
    success: true,
    ...(message && { message }),
    ...(data !== undefined && { data })
  };
}

export function errorResponse(error, status = 500) {
  return {
    success: false,
    error: typeof error === 'string' ? error : error.message || 'Internal server error'
  };
}

/**
 * Return error.message only in non-production environments.
 * In production, returns a generic message to prevent information leakage.
 */
export function safeErrorDetails(error) {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }
  return typeof error === 'string' ? error : error?.message;
}

export default { successResponse, errorResponse, safeErrorDetails };
