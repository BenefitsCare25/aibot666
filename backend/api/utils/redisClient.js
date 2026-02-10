/**
 * Shared Redis Client
 * Single connection used across the application
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create single Redis client with TLS support
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  tls: REDIS_URL.startsWith('rediss://') ? {
    rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
  } : undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis() {
  try {
    await redis.quit();
    console.log('Redis disconnected gracefully');
  } catch (error) {
    console.error('Error closing Redis:', error);
  }
}

/**
 * Health check - verify Redis is connected
 */
export async function pingRedis() {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis ping failed:', error);
    return false;
  }
}

export { redis };
export default redis;
