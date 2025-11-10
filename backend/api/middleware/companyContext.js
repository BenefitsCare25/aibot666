import { getCompanyByDomain, normalizeDomain } from '../services/companySchema.js';
import { getSchemaClient } from '../../config/supabase.js';
import { redis } from '../utils/session.js';

// Cache TTL for company lookups (5 minutes)
const COMPANY_CACHE_TTL = 300;

/**
 * Middleware to extract domain and set company context
 * Adds company info and schema-specific Supabase client to req object
 */
export async function companyContextMiddleware(req, res, next) {
  try {
    // Extract domain from multiple sources
    let domain = extractDomainFromRequest(req);

    if (!domain) {
      // For testing or when domain is not available, use default
      domain = 'localhost';
      console.warn('No domain found in request, using default: localhost');
    }

    // Normalize domain for consistent lookup
    const normalizedDomain = normalizeDomain(domain);
    console.log(`[Company Lookup] Original domain: ${domain} -> Normalized: ${normalizedDomain}`);

    // Try to get from cache first
    const cachedCompany = await getCachedCompany(normalizedDomain);

    let company;
    if (cachedCompany) {
      company = cachedCompany;
      console.log(`[Cache Hit] Company found for domain: ${normalizedDomain}`);
    } else {
      // Lookup company from database
      company = await getCompanyByDomain(normalizedDomain);

      if (company) {
        // Cache the result
        await cacheCompany(normalizedDomain, company);
        console.log(`[DB Lookup] Company found: ${company.name} (${company.schema_name})`);
      } else {
        console.warn(`No company found for domain: ${normalizedDomain}`);
        return res.status(404).json({
          success: false,
          error: 'Company not found for this domain',
          domain: normalizedDomain,
          hint: 'Please ensure a company is registered with this domain in the admin panel. Check the Company Selector to verify the correct domain is selected.'
        });
      }
    }

    // Check if company is active
    if (company.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Company account is not active',
        status: company.status
      });
    }

    // Get schema-specific Supabase client
    const schemaClient = getSchemaClient(company.schema_name);

    // Add company context to request object
    req.company = {
      id: company.id,
      name: company.name,
      domain: company.domain,
      schemaName: company.schema_name,
      settings: company.settings || {},
      metadata: company.metadata || {}
    };

    // Add schema name directly for easy access
    req.companySchema = company.schema_name;

    // Add schema-specific Supabase client to request
    req.supabase = schemaClient;

    // Log request with company context
    console.log(`[${req.method}] ${req.path} - Company: ${company.name} (${company.schema_name})`);

    next();
  } catch (error) {
    console.error('Error in company context middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to identify company context'
    });
  }
}

/**
 * Extract domain from request headers and body
 * @param {Object} req - Express request object
 * @returns {string|null} - Extracted domain
 */
function extractDomainFromRequest(req) {
  // Priority order for domain extraction:
  // 1. Explicit domain in request body (from widget)
  // 2. X-Widget-Domain custom header (from widget)
  // 3. Origin header (from CORS)
  // 4. Referer header
  // 5. Host header (fallback for testing)

  let domain = null;

  // 1. Check request body (for POST requests from widget)
  if (req.body && req.body.domain) {
    domain = req.body.domain;
    console.log(`Domain from body: ${domain}`);
    return domain;
  }

  // 2. Check custom header (X-Widget-Domain)
  if (req.headers['x-widget-domain']) {
    domain = req.headers['x-widget-domain'];
    console.log(`Domain from X-Widget-Domain header: ${domain}`);
    return domain;
  }

  // 3. Check Origin header (most reliable for CORS requests)
  if (req.headers.origin) {
    domain = req.headers.origin;
    console.log(`Domain from Origin header: ${domain}`);
    return domain;
  }

  // 4. Check Referer header
  if (req.headers.referer || req.headers.referrer) {
    domain = req.headers.referer || req.headers.referrer;
    console.log(`Domain from Referer header: ${domain}`);
    return domain;
  }

  // 5. Fallback to Host header (for testing)
  if (req.headers.host) {
    domain = req.headers.host;
    console.log(`Domain from Host header (fallback): ${domain}`);
    return domain;
  }

  return null;
}

/**
 * Get company from Redis cache
 * @param {string} domain - Normalized domain
 * @returns {Promise<Object|null>} - Cached company or null
 */
async function getCachedCompany(domain) {
  try {
    const cacheKey = `company:domain:${domain}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  } catch (error) {
    console.error('Error getting cached company:', error);
    return null;
  }
}

/**
 * Cache company lookup result
 * @param {string} domain - Normalized domain
 * @param {Object} company - Company object
 * @returns {Promise<void>}
 */
async function cacheCompany(domain, company) {
  try {
    const cacheKey = `company:domain:${domain}`;
    await redis.setex(cacheKey, COMPANY_CACHE_TTL, JSON.stringify(company));
  } catch (error) {
    console.error('Error caching company:', error);
    // Don't throw - caching is not critical
  }
}

/**
 * Invalidate company cache for a domain
 * @param {string} domain - Domain to invalidate
 * @returns {Promise<void>}
 */
export async function invalidateCompanyCache(domain) {
  try {
    const normalizedDomain = normalizeDomain(domain);
    const cacheKey = `company:domain:${normalizedDomain}`;
    await redis.del(cacheKey);
    console.log(`Cache invalidated for domain: ${normalizedDomain}`);
  } catch (error) {
    console.error('Error invalidating company cache:', error);
  }
}

/**
 * Optional middleware for admin routes that don't need company context
 * Adds default public schema client
 */
export function adminContextMiddleware(req, res, next) {
  // Use default supabase client for admin operations on public schema
  const supabase = getSchemaClient(null); // null returns default public schema client
  req.supabase = supabase;
  req.isAdmin = true;
  next();
}

export default {
  companyContextMiddleware,
  adminContextMiddleware,
  invalidateCompanyCache
};
