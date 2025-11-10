/**
 * Script to clear all company domain caches from Redis
 * Run this to fix cache issues after company updates
 */

import { redis } from '../api/utils/session.js';

async function clearAllCompanyCaches() {
  console.log(`\n==========================================`);
  console.log(`  Clear Company Domain Caches`);
  console.log(`==========================================\n`);

  try {
    // Get all keys matching the company cache pattern
    const pattern = 'company:domain:*';
    console.log(`[1/3] Scanning for keys matching pattern: ${pattern}`);

    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      console.log('\n✅ No cached company domains found. Cache is already clear.\n');
      await redis.quit();
      process.exit(0);
      return;
    }

    console.log(`[2/3] Found ${keys.length} cached company domains:`);
    keys.forEach(key => {
      const domain = key.replace('company:domain:', '');
      console.log(`  - ${domain}`);
    });

    // Delete all matching keys
    console.log(`\n[3/3] Deleting all cached entries...`);
    const deleted = await redis.del(...keys);

    console.log(`\n✅ SUCCESS: Cleared ${deleted} company domain cache entries`);
    console.log(`All company lookups will now fetch fresh data from the database.\n`);

  } catch (error) {
    console.error(`\n❌ ERROR: Failed to clear company caches:`, error.message);
    console.error(error);
    process.exit(1);
  }

  // Close Redis connection
  await redis.quit();
  process.exit(0);
}

clearAllCompanyCaches().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
