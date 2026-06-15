import OpenAI from 'openai';
import { pingRedis } from '../utils/redisClient.js';
import { getQueueMetrics } from './jobQueue.js';
import { checkEmailHealth } from './email.js';
import { checkTelegramHealth } from './telegram.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHECK_TIMEOUT_MS = 8000;

export async function getSystemHealth(supabaseClient) {
  const checks = await Promise.all([
    runCheck('database', async () => {
      const startedAt = Date.now();
      const { error } = await supabaseClient
        .from('chat_history')
        .select('id', { count: 'exact', head: true })
        .limit(1);
      if (error) throw error;
      return { status: 'operational', latencyMs: Date.now() - startedAt };
    }),
    runCheck('redis', async () => {
      const startedAt = Date.now();
      const healthy = await pingRedis();
      if (!healthy) throw new Error('Redis ping failed');
      return { status: 'operational', latencyMs: Date.now() - startedAt };
    }),
    runCheck('openai', async () => {
      if (!process.env.OPENAI_API_KEY) {
        return { status: 'disabled', detail: 'OpenAI API key is not configured' };
      }
      const startedAt = Date.now();
      await openai.models.list({ timeout: CHECK_TIMEOUT_MS });
      return { status: 'operational', latencyMs: Date.now() - startedAt };
    }),
    runCheck('documentQueue', async () => {
      const metrics = await getQueueMetrics();
      if (!metrics) throw new Error('Queue metrics unavailable');
      return {
        status: metrics.failed > 0 ? 'degraded' : 'operational',
        detail: `${metrics.waiting} waiting, ${metrics.active} active, ${metrics.failed} failed`,
        metrics
      };
    }),
    runCheck('email', checkEmailHealth),
    runCheck('telegram', checkTelegramHealth)
  ]);

  const services = Object.fromEntries(checks.map(check => [check.name, check.result]));
  const activeStatuses = Object.values(services)
    .map(service => service.status)
    .filter(status => status !== 'disabled');
  const status = activeStatuses.includes('unavailable')
    ? 'unavailable'
    : activeStatuses.includes('degraded')
      ? 'degraded'
      : 'operational';

  return {
    status,
    checkedAt: new Date().toISOString(),
    services
  };
}

async function runCheck(name, check) {
  try {
    const result = await withTimeout(check(), CHECK_TIMEOUT_MS);
    return { name, result };
  } catch (error) {
    return {
      name,
      result: {
        status: 'unavailable',
        detail: error.message
      }
    };
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timed out')), timeoutMs);
    })
  ]);
}
