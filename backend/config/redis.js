/**
 * Consolidated Redis Configuration
 * Shared parseRedisUrl and connection settings for ioredis and BullMQ
 */

import dotenv from 'dotenv';
dotenv.config();

export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Parse Redis URL into BullMQ-compatible connection object
 * Supports Azure Redis TLS (rediss://) connections
 * @param {string} url - Redis connection URL
 * @returns {Object} - Connection config for BullMQ
 */
export function parseRedisUrl(url = REDIS_URL) {
  try {
    const urlObj = new URL(url);
    const isTls = urlObj.protocol === 'rediss:';
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || (isTls ? 6380 : 6379),
      password: urlObj.password ? decodeURIComponent(urlObj.password) : undefined,
      username: urlObj.username || undefined,
      tls: isTls ? { rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false' } : undefined,
    };
  } catch (error) {
    console.error('Error parsing Redis URL:', error);
    return {
      host: 'localhost',
      port: 6379
    };
  }
}

export default { REDIS_URL, parseRedisUrl };
