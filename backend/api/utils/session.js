import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SESSION_TTL = parseInt(process.env.REDIS_SESSION_TTL) || 3600; // 1 hour default

// Create Redis client
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redis.on('connect', () => {
  console.log('✓ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

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
    await redis.setex(key, SESSION_TTL, JSON.stringify(session));

    // Also extend conversation history TTL
    const historyKey = `history:${session.conversationId}`;
    await redis.expire(historyKey, SESSION_TTL);

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

    await redis.rpush(historyKey, JSON.stringify(messageData));
    await redis.expire(historyKey, SESSION_TTL);

    // Keep only last 20 messages in Redis for performance
    const length = await redis.llen(historyKey);
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
 * @returns {Promise<Array>} - Array of messages
 */
export async function getConversationHistory(conversationId, limit = 10) {
  try {
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
    const keys = await redis.keys('session:*');
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
    const keys = await redis.keys('session:*');
    return keys.length;
  } catch (error) {
    console.error('Error getting session count:', error);
    return 0;
  }
}

/**
 * Cache query result
 * @param {string} queryHash - Hash of the query
 * @param {Object} result - Query result to cache
 * @param {number} ttl - Time to live in seconds (default 300 = 5 minutes)
 * @returns {Promise<boolean>} - Success status
 */
export async function cacheQueryResult(queryHash, result, ttl = 300) {
  try {
    const cacheKey = `query:${queryHash}`;
    await redis.setex(cacheKey, ttl, JSON.stringify(result));
    return true;
  } catch (error) {
    console.error('Error caching query result:', error);
    return false;
  }
}

/**
 * Get cached query result
 * @param {string} queryHash - Hash of the query
 * @returns {Promise<Object|null>} - Cached result or null
 */
export async function getCachedQueryResult(queryHash) {
  try {
    const cacheKey = `query:${queryHash}`;
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
 * Close Redis connection
 */
export async function closeRedis() {
  try {
    await redis.quit();
    console.log('Redis connection closed');
  } catch (error) {
    console.error('Error closing Redis connection:', error);
  }
}

export { redis };

export default {
  createSession,
  getSession,
  touchSession,
  deleteSession,
  addMessageToHistory,
  getConversationHistory,
  clearConversationHistory,
  getActiveSessions,
  getSessionCount,
  cacheQueryResult,
  getCachedQueryResult,
  checkRateLimit,
  closeRedis,
  redis
};
