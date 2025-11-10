import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

async function clearClusterCache() {
  const redis = new Redis(redisUrl);

  try {
    console.log('🔍 Searching for cluster cache keys...');

    // Find all cluster cache keys
    const keys = await redis.keys('clusters:group:*');

    if (keys.length === 0) {
      console.log('✅ No cluster cache keys found');
    } else {
      console.log(`🗑️  Found ${keys.length} cluster cache key(s):`);
      keys.forEach((key) => console.log(`   - ${key}`));

      // Delete all cluster cache keys
      await redis.del(...keys);
      console.log('✅ Successfully cleared all cluster caches!');
    }

    await redis.quit();
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  }
}

clearClusterCache();
