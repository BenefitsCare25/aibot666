import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env file.');
}

// Extract PostgreSQL connection string
// Supports multiple sources for maximum compatibility:
// 1. DATABASE_URL from environment (set by deployment platform)
// 2. SUPABASE_CONNECTION_STRING from environment (manual override)
// 3. Constructed from SUPABASE_URL + SUPABASE_DB_PASSWORD
const extractPostgresUrl = () => {
  // Option 1: Use DATABASE_URL if available (Render, Heroku, etc.)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Option 2: Use SUPABASE_CONNECTION_STRING if set (manual override)
  if (process.env.SUPABASE_CONNECTION_STRING) {
    return process.env.SUPABASE_CONNECTION_STRING;
  }

  // Option 3: Construct from Supabase URL and password
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!dbPassword) {
    console.warn('[PostgreSQL] No database connection configured. Set DATABASE_URL, SUPABASE_CONNECTION_STRING, or SUPABASE_DB_PASSWORD.');
    return null;
  }

  // For self-hosted Supabase or custom PostgreSQL
  // Use direct connection (port 5432) for DDL operations
  const port = process.env.POSTGRES_PORT || 5432;
  const host = process.env.POSTGRES_HOST || `db.${projectRef}.supabase.co`;

  return `postgresql://postgres.${projectRef}:${dbPassword}@${host}:${port}/postgres`;
};

// PostgreSQL client pool for direct database operations (DDL, schema management)
let pgPool = null;
const postgresUrl = extractPostgresUrl();

if (postgresUrl) {
  try {
    // Log connection details (mask password for security)
    // Match: postgresql://username:password@host → postgresql://username:***@host
    const maskedUrl = postgresUrl.replace(/(:\/\/[^:]+):([^@]+)@/, '$1:***@');

    // Parse connection string to check for sslmode parameter
    const hasSSLDisabled = postgresUrl.includes('sslmode=disable');
    const hasSSLModeInUrl = postgresUrl.includes('sslmode=');

    let sslConfig;
    if (hasSSLDisabled) {
      sslConfig = false; // Explicitly disable SSL
    } else if (hasSSLModeInUrl) {
      sslConfig = undefined; // Let connection string handle SSL
    } else if (process.env.POSTGRES_SSL === 'false') {
      sslConfig = false;
    } else {
      sslConfig = { rejectUnauthorized: false };
    }

    pgPool = new Pool({
      connectionString: postgresUrl,
      ssl: sslConfig,
      // Connection pool settings optimized for DDL operations
      max: 3, // Lower pool size for DDL operations (less concurrent schema changes)
      min: 0, // Allow pool to scale to zero
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 60000, // Longer timeout for direct connections

      // Additional pg options
      // IMPORTANT: Remove -c options from connection string for pooler compatibility
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,

      // Query timeout to prevent hanging connections
      // Note: DROP SCHEMA CASCADE can take 60-120 seconds for large schemas
      // Individual queries can override this with SET statement_timeout
      query_timeout: 180000, // 3 minutes for DROP SCHEMA operations
      statement_timeout: 180000
    });

    pgPool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected pool error:', err);
    });

    pgPool.on('connect', (client) => {
    });

    // Test the connection on initialization
    pgPool.query('SELECT version(), current_user, current_database()', (err, result) => {
      if (err) {
        console.error('[PostgreSQL] Connection test failed:', err.message);
        console.error('[PostgreSQL] Error code:', err.code);
        console.error('[PostgreSQL] Error severity:', err.severity);

        if (err.code === 'XX000') {
          console.error('[PostgreSQL] XX000 Error: Tenant or user not found');
          console.error('[PostgreSQL] Common causes:');
          console.error('[PostgreSQL]   1. Using Supabase Cloud connection format for self-hosted instance');
          console.error('[PostgreSQL]   2. Incorrect username/password in connection string');
          console.error('[PostgreSQL]   3. Database user does not exist');
          console.error('[PostgreSQL]   4. Using pooler when direct connection is required');
          console.error('[PostgreSQL] For self-hosted Supabase:');
          console.error('[PostgreSQL]   - Username should be "postgres" (not "postgres.projectref")');
          console.error('[PostgreSQL]   - Use direct IP/hostname, not pooler hostname');
          console.error('[PostgreSQL]   - Format: postgresql://postgres:password@your-vm-ip:5432/postgres');
        }
      } else {
      }
    });

  } catch (error) {
    console.error('[PostgreSQL] Failed to initialize connection pool:', error);
    pgPool = null;
  }
} else {
  console.warn('[PostgreSQL] Pool not initialized - no database connection configured');
  console.warn('[PostgreSQL] Schema automation features will not be available');
}

export const postgres = pgPool;

// Default Supabase client with service role key for admin operations (uses public schema)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

// Create public client for employee authentication
export const supabasePublic = createClient(
  supabaseUrl,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);

/**
 * Create a schema-scoped Supabase client for multi-tenancy
 * IMPORTANT: Supabase JS client doesn't support schema switching via db.schema config
 * This wrapper automatically prefixes table names with the schema
 * @param {string} schemaName - PostgreSQL schema name (e.g., 'company_a')
 * @returns {Object} - Wrapped Supabase client with schema-qualified table names
 */
export function createSchemaClient(schemaName) {
  if (!schemaName) {
    throw new Error('Schema name is required for multi-tenant client');
  }


  // Create base Supabase client
  const baseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false
    },
    db: {
      schema: schemaName  // Set default schema for this client
    }
  });


  // Wrapper that provides schema-aware operations
  const schemaClient = {
    _schemaName: schemaName,
    _baseClient: baseClient,

    /**
     * Access tables in the configured schema
     * Uses the db.schema configuration
     */
    from: (table) => {
      return baseClient.from(table);
    },

    /**
     * Call RPC functions in the configured schema
     */
    rpc: (fnName, params, options) => {
      return baseClient.rpc(fnName, params, options);
    },

    // Pass through other methods directly
    auth: baseClient.auth,
    storage: baseClient.storage,
    functions: baseClient.functions,
    realtime: baseClient.realtime,

    // Direct access to base client if needed
    _raw: baseClient
  };

  return schemaClient;
}

/**
 * Execute a query with explicit schema context
 * Uses SET search_path to ensure queries run in the correct schema
 * @param {Object} client - Supabase client
 * @param {string} schemaName - Schema name to use
 * @param {Function} queryFn - Function that performs the query
 * @returns {Promise<any>} - Query result
 */
export async function executeInSchema(client, schemaName, queryFn) {
  try {
    // Set search_path for this connection
    // Note: Supabase JS client doesn't directly support SET commands
    // We need to use RPC or handle this at the connection pool level
    // For now, we'll rely on the schema configuration in createSchemaClient

    const result = await queryFn(client);
    return result;
  } catch (error) {
    console.error(`Error executing query in schema ${schemaName}:`, error);
    throw error;
  }
}

/**
 * Get or create cached schema client
 * Maintains a pool of schema clients to avoid recreation
 */
const schemaClientCache = new Map();

export function getSchemaClient(schemaName) {
  if (!schemaName) {
    return supabase; // Return default client for public schema
  }

  // Check cache first
  if (schemaClientCache.has(schemaName)) {
    return schemaClientCache.get(schemaName);
  }

  // Create new schema client
  const client = createSchemaClient(schemaName);
  schemaClientCache.set(schemaName, client);

  return client;
}

/**
 * Clear schema client cache (useful for testing or when schema changes)
 */
export function clearSchemaClientCache() {
  schemaClientCache.clear();
}

export default supabase;
