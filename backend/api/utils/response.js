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

export default { successResponse, errorResponse };
