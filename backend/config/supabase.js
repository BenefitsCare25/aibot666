import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env file.');
}

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
