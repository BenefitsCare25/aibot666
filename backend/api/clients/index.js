/**
 * Centralized Client Exports
 * Import common dependencies from this single location
 *
 * Usage:
 *   import { supabase, redis, generateEmbedding } from '../clients/index.js';
 */

// Database clients
export {
  default as supabase,
  postgres,
  supabasePublic,
  createSchemaClient,
  getSchemaClient,
  clearSchemaClientCache,
  executeInSchema
} from '../../config/supabase.js';

// Redis client
export {
  default as redis,
  closeRedis,
  pingRedis
} from '../utils/redisClient.js';

// OpenAI embedding functions
export {
  generateEmbedding,
  generateEmbeddingsBatch
} from '../services/openai.js';
