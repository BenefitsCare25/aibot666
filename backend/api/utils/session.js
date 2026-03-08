import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { redis, closeRedis } from './redisClient.js';

dotenv.config();

const SESSION_TTL = parseInt(process.env.REDIS_SESSION_TTL) || 3600; // 1 hour default

/**
 * Create a new session for an employee
 * @param {string} employeeId - Employee ID
 * @param {Object} metadata - Additional session metadata
 * @returns {Promise<string>} - Session ID
 */
export async function createSession(employeeId, metadata = {}) {
  try {
    const sessionId = uuidv4();
    const conversationId = uuidv4();

    const sessionData = {
      sessionId,
      conversationId,
      employeeId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 0,
      metadata
    };

    const key = `session:${sessionId}`;
    await redis.setex(key, SESSION_TTL, JSON.stringify(sessionData));

    // Create reverse lookup: conversationId → sessionId (for ownership validation)
    await redis.setex(`conv:${conversationId}`, SESSION_TTL, sessionId);

    // Create conversation history key
    const historyKey = `history:${conversationId}`;
    await redis.expire(historyKey, SESSION_TTL);

    return { sessionId, conversationId };
  } catch (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }
}

/**
 * Get session data
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} - Session data or null if not found
 */
export async function getSession(sessionId) {
  try {
    const key = `session:${sessionId}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting session:', error);
    throw new Error('Failed to retrieve session');
  }
}

/**
 * Save/update session data
 * @param {string} sessionId - Session ID
 * @param {Object} sessionData - Session data to save
 * @returns {Promise<boolean>} - Success status
 */
export async function saveSession(sessionId, sessionData) {
  try {
    const key = `session:${sessionId}`;
    sessionData.lastActivity = new Date().toISOString();
    await redis.setex(key, SESSION_TTL, JSON.stringify(sessionData));
    return true;
  } catch (error) {
    console.error('Error saving session:', error);
    throw new Error('Failed to save session');
  }
}

/**
 * Update session activity timestamp
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} - Success status
 */
export async function touchSession(sessionId) {
  try {
    const session = await getSession(sessionId);

    if (!session) {
      return false;
    }

    session.lastActivity = new Date().toISOString();
    session.messageCount = (session.messageCount || 0) + 1;

    const key = `session:${sessionId}`;
    const historyKey = `history:${session.conversationId}`;

    // Pipeline: batch SETEX + EXPIRE into single round-trip
    const pipeline = redis.pipeline();
    pipeline.setex(key, SESSION_TTL, JSON.stringify(session));
    pipeline.expire(historyKey, SESSION_TTL);
    await pipeline.exec();

    return true;
  } catch (error) {
    console.error('Error touching session:', error);
    return false;
  }
}

/**
 * Delete a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteSession(sessionId) {
  try {
    const session = await getSession(sessionId);

    if (session) {
      // Delete conversation history
      const historyKey = `history:${session.conversationId}`;
      await redis.del(historyKey);
    }

    const key = `session:${sessionId}`;
    await redis.del(key);

    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
}

/**
 * Add message to conversation history
 * @param {string} conversationId - Conversation ID
 * @param {Object} message - Message object {role, content, timestamp}
 * @returns {Promise<boolean>} - Success status
 */
export async function addMessageToHistory(conversationId, message) {
  try {
    const historyKey = `history:${conversationId}`;
    const messageData = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    };

    // Pipeline: batch RPUSH + EXPIRE + LLEN into single round-trip
    const pipeline = redis.pipeline();
    pipeline.rpush(historyKey, JSON.stringify(messageData));
    pipeline.expire(historyKey, SESSION_TTL);
    pipeline.llen(historyKey);
    const results = await pipeline.exec();

    // Conditional LTRIM only if length > 20
    const length = results[2]?.[1];
    if (length > 20) {
      await redis.ltrim(historyKey, -20, -1);
    }

    return true;
  } catch (error) {
    console.error('Error adding message to history:', error);
    return false;
  }
}

/**
 * Get conversation history
 * @param {string} conversationId - Conversation ID
 * @param {number} limit - Maximum number of messages to retrieve
 * @param {string} employeeId - Optional employee ID for validation (security check)
 * @returns {Promise<Array>} - Array of messages
 */
export async function getConversationHistory(conversationId, limit = 10, employeeId = null) {
  try {
    // SECURITY: If employeeId is provided, validate conversation belongs to this employee
    if (employeeId) {
      // Use reverse lookup key instead of scanning all sessions
      const ownerSessionId = await redis.get(`conv:${conversationId}`);
      if (ownerSessionId) {
        const ownerSession = await getSession(ownerSessionId);
        if (ownerSession && ownerSession.employeeId !== employeeId) {
          console.warn(`Security: Employee ${employeeId} attempted to access conversation ${conversationId} owned by ${ownerSession.employeeId}`);
          return []; // Return empty history to prevent data leakage
        }
      }
    }

    const historyKey = `history:${conversationId}`;
    const messages = await redis.lrange(historyKey, -limit, -1);

    return messages.map(msg => JSON.parse(msg));
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

/**
 * Clear conversation history
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>} - Success status
 */
export async function clearConversationHistory(conversationId) {
  try {
    const historyKey = `history:${conversationId}`;
    await redis.del(historyKey);
    return true;
  } catch (error) {
    console.error('Error clearing conversation history:', error);
    return false;
  }
}

/**
 * Get all active sessions (for monitoring)
 * @returns {Promise<Array>} - Array of active session IDs
 */
export async function getActiveSessions() {
  try {
    const keys = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', 'session:*', 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys.map(key => key.replace('session:', ''));
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return [];
  }
}

/**
 * Get session count (for analytics)
 * @returns {Promise<number>} - Number of active sessions
 */
export async function getSessionCount() {
  try {
    let count = 0;
    let cursor = '0';
    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', 'session:*', 'COUNT', 100);
      cursor = nextCursor;
      count += batch.length;
    } while (cursor !== '0');
    return count;
  } catch (error) {
    console.error('Error getting session count:', error);
    return 0;
  }
}

/**
 * Cache query result
 * @param {string} cacheKey - Full namespaced cache key (query:{schemaName}:{hash})
 * @param {Object} result - Query result to cache
 * @param {number} ttl - Time to live in seconds (default 3600 = 1 hour)
 * @returns {Promise<boolean>} - Success status
 */
export async function cacheQueryResult(cacheKey, result, ttl = 3600) {
  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(result));
    return true;
  } catch (error) {
    console.error('Error caching query result:', error);
    return false;
  }
}

/**
 * Get cached query result
 * @param {string} cacheKey - Full namespaced cache key (query:{schemaName}:{hash})
 * @returns {Promise<Object|null>} - Cached result or null
 */
export async function getCachedQueryResult(cacheKey) {
  try {
    const data = await redis.get(cacheKey);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting cached query result:', error);
    return null;
  }
}

/**
 * Compute cosine similarity between two vectors
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} similarity score 0-1
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find semantically similar cached answer using embedding comparison
 * @param {string} schemaName - Company schema name (namespace)
 * @param {number[]} queryEmbedding - Pre-computed query embedding
 * @param {number} threshold - Minimum cosine similarity (default 0.95)
 * @returns {Promise<Object|null>} - Cached result or null
 */
export async function getSemanticCacheMatch(schemaName, queryEmbedding, threshold = 0.95) {
  try {
    const indexKey = `query:index:${schemaName}`;
    const hashes = await redis.smembers(indexKey);
    if (!hashes || hashes.length === 0) return null;

    for (const hash of hashes) {
      const embeddingRaw = await redis.get(`query:embed:${schemaName}:${hash}`);
      if (!embeddingRaw) continue;

      const cachedEmbedding = JSON.parse(embeddingRaw);
      const similarity = cosineSimilarity(queryEmbedding, cachedEmbedding);

      if (similarity >= threshold) {
        const answerRaw = await redis.get(`query:${schemaName}:${hash}`);
        if (answerRaw) {
          return JSON.parse(answerRaw);
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error in getSemanticCacheMatch:', error);
    return null;
  }
}

/**
 * Store answer + embedding in semantic cache
 * @param {string} schemaName - Company schema name
 * @param {string} hash - SHA-256 hash of the query
 * @param {Object} answer - Answer object to cache
 * @param {number[]} embedding - Query embedding vector
 * @param {number} ttl - TTL in seconds (default 3600)
 * @returns {Promise<boolean>}
 */
export async function setSemanticCache(schemaName, hash, answer, embedding, ttl = 3600) {
  try {
    const pipeline = redis.pipeline();
    pipeline.setex(`query:${schemaName}:${hash}`, ttl, JSON.stringify(answer));
    pipeline.setex(`query:embed:${schemaName}:${hash}`, ttl, JSON.stringify(embedding));
    pipeline.sadd(`query:index:${schemaName}`, hash);
    pipeline.expire(`query:index:${schemaName}`, ttl);
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error('Error in setSemanticCache:', error);
    return false;
  }
}

/**
 * Invalidate all query cache entries for a company schema
 * Called when KB is mutated (create/update/delete)
 * @param {string} schemaName - Company schema name
 * @returns {Promise<void>}
 */
export async function invalidateCompanyQueryCache(schemaName) {
  try {
    const patterns = [
      `query:${schemaName}:*`,
      `query:embed:${schemaName}:*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      let cursor = '0';
      const keysToDelete = [];
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
        totalDeleted += keysToDelete.length;
      }
    }

    // Delete the index set
    await redis.del(`query:index:${schemaName}`);

    if (totalDeleted > 0) {
      console.info(`[Cache] Invalidated ${totalDeleted} query cache entries for ${schemaName}`);
    }
  } catch (error) {
    console.error('[Cache] invalidateCompanyQueryCache error:', error.message);
    // Non-fatal — cache invalidation failure should not break KB save
  }
}

/**
 * Rate limiting check
 * @param {string} identifier - User/IP identifier
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<Object>} - {allowed: boolean, remaining: number, resetAt: timestamp}
 */
export async function checkRateLimit(identifier, maxRequests = 100, windowSeconds = 60) {
  try {
    const key = `ratelimit:${identifier}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);
    const resetAt = Date.now() + (ttl * 1000);

    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetAt,
      current
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Allow request on error to prevent blocking
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + (windowSeconds * 1000) };
  }
}

/**
 * Update conversation state (for tracking bot actions like escalations)
 * @param {string} sessionId - Session ID
 * @param {Object} state - Conversation state to update
 * @returns {Promise<boolean>} - Success status
 */
export async function updateConversationState(sessionId, state) {
  try {
    const session = await getSession(sessionId);

    if (!session) {
      return false;
    }

    // Initialize conversationState if it doesn't exist
    if (!session.conversationState) {
      session.conversationState = {};
    }

    // Update state fields
    session.conversationState = {
      ...session.conversationState,
      ...state,
      lastUpdated: new Date().toISOString()
    };

    await saveSession(sessionId, session);
    return true;
  } catch (error) {
    console.error('Error updating conversation state:', error);
    return false;
  }
}

/**
 * Get conversation state
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} - Conversation state or null
 */
export async function getConversationState(sessionId) {
  try {
    const session = await getSession(sessionId);
    return session?.conversationState || null;
  } catch (error) {
    console.error('Error getting conversation state:', error);
    return null;
  }
}

export { redis, closeRedis };

export default {
  createSession,
  getSession,
  saveSession,
  touchSession,
  deleteSession,
  addMessageToHistory,
  getConversationHistory,
  clearConversationHistory,
  getActiveSessions,
  getSessionCount,
  cacheQueryResult,
  getCachedQueryResult,
  getSemanticCacheMatch,
  setSemanticCache,
  invalidateCompanyQueryCache,
  checkRateLimit,
  updateConversationState,
  getConversationState,
  closeRedis,
  redis
};
