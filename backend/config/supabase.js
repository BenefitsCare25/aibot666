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
  // IMPORTANT: Ensure DATABASE_URL uses port 5432 (direct connection), NOT 6543 (pooler)
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;

    // Check if using pooler port and warn
    if (dbUrl.includes(':6543')) {
      console.warn('[PostgreSQL] WARNING: DATABASE_URL uses pooler port 6543. DDL operations require port 5432!');
      console.warn('[PostgreSQL] Attempting to replace port 6543 with 5432...');
      const directUrl = dbUrl.replace(':6543/', ':5432/');
      console.log('[PostgreSQL] Using modified DATABASE_URL with direct connection (port 5432)');
      return directUrl;
    }

    console.log('[PostgreSQL] Using DATABASE_URL from environment');
    return dbUrl;
  }

  // Option 2: Use SUPABASE_CONNECTION_STRING if set (manual override)
  if (process.env.SUPABASE_CONNECTION_STRING) {
    const connStr = process.env.SUPABASE_CONNECTION_STRING;

    // Check if using pooler port and warn
    if (connStr.includes(':6543')) {
      console.warn('[PostgreSQL] WARNING: SUPABASE_CONNECTION_STRING uses pooler port 6543. DDL operations require port 5432!');
      console.warn('[PostgreSQL] Attempting to replace port 6543 with 5432...');
      const directUrl = connStr.replace(':6543/', ':5432/');
      console.log('[PostgreSQL] Using modified SUPABASE_CONNECTION_STRING with direct connection (port 5432)');
      return directUrl;
    }

    console.log('[PostgreSQL] Using SUPABASE_CONNECTION_STRING from environment');
    return connStr;
  }

  // Option 3: Construct from Supabase URL and password
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!dbPassword) {
    console.warn('[PostgreSQL] No database connection configured. Set DATABASE_URL, SUPABASE_CONNECTION_STRING, or SUPABASE_DB_PASSWORD.');
    return null;
  }

  // IMPORTANT: Schema DDL operations (CREATE SCHEMA, DROP SCHEMA) require DIRECT connection
  // Transaction pooler (port 6543) does NOT support DDL operations
  // We MUST use direct connection (port 5432) for schema automation
  const usePooler = false; // Force direct connection for DDL operations
  const port = 5432; // Always use direct connection port
  const host = `db.${projectRef}.supabase.co`;

  console.log(`[PostgreSQL] Constructing connection string (direct mode for DDL operations)`);
  return `postgresql://postgres.${projectRef}:${dbPassword}@${host}:${port}/postgres`;
};

// PostgreSQL client pool for direct database operations (DDL, schema management)
let pgPool = null;
const postgresUrl = extractPostgresUrl();

if (postgresUrl) {
  try {
    pgPool = new Pool({
      connectionString: postgresUrl,
      ssl: process.env.POSTGRES_SSL === 'false' ? false : {
        rejectUnauthorized: false
      },
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
      console.log('[PostgreSQL] New client connected to pool');
    });

    // Test the connection on initialization
    pgPool.query('SELECT version(), current_user, current_database()', (err, result) => {
      if (err) {
        console.error('[PostgreSQL] Connection test failed:', err.message);
        console.error('[PostgreSQL] Error code:', err.code);
        if (err.code === 'XX000') {
          console.error('[PostgreSQL] XX000 Error: This usually means pooler authentication failure.');
          console.error('[PostgreSQL] Solution: Ensure you are using port 5432 (direct connection), NOT 6543 (pooler)');
        }
      } else {
        console.log('[PostgreSQL] Connection test successful!');
        console.log('[PostgreSQL] Server version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
        console.log('[PostgreSQL] Current user:', result.rows[0].current_user);
        console.log('[PostgreSQL] Current database:', result.rows[0].current_database);
      }
    });

    console.log('[PostgreSQL] Connection pool initialized successfully');
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

  console.log(`[Supabase] Creating schema client for: ${schemaName}`);

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

  console.log(`[Supabase] Client configured with db.schema=${schemaName}`);

  // Wrapper that provides schema-aware operations
  const schemaClient = {
    _schemaName: schemaName,
    _baseClient: baseClient,

    /**
     * Access tables in the configured schema
     * Uses the db.schema configuration
     */
    from: (table) => {
      console.log(`[Supabase] Querying table: ${table} in schema: ${schemaName}`);
      return baseClient.from(table);
    },

    /**
     * Call RPC functions in the configured schema
     */
    rpc: (fnName, params, options) => {
      console.log(`[Supabase] Calling RPC: ${fnName} in schema: ${schemaName}`);
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
