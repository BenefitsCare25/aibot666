/**
 * Shared Pagination Utilities
 */

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT), MAX_LIMIT);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginationResponse(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  };
}

export default { parsePagination, paginationResponse };
