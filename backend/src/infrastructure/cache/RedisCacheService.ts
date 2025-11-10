import Redis from 'ioredis';
import { env } from '../../config/env.js';

export class RedisCacheService {
  private client: Redis;
  private readonly defaultTTL = 3600; // 1 hour in seconds

  constructor() {
    this.client = new Redis(env.get('REDIS_URL'), {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('✅ Redis cache connected');
    });
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const expiryTime = ttl || this.defaultTTL;

      await this.client.setex(key, expiryTime, serialized);
    } catch (error) {
      console.error(`Redis set error for key ${key}:`, error);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Redis delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error(`Redis delete pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, ttl?: number): Promise<number> {
    try {
      const value = await this.client.incr(key);
      if (ttl) {
        await this.client.expire(key, ttl);
      }
      return value;
    } catch (error) {
      console.error(`Redis increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];

      const values = await this.client.mget(...keys);
      return values.map((value) => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('Redis mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Cache wrapper - get from cache or execute function and cache result
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }

  /**
   * Disconnect Redis client
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

// Cache key builders for consistency
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  group: (groupId: string) => `group:${groupId}`,
  groupsByUser: (userId: string) => `groups:user:${userId}`,
  groupMembers: (groupId: string) => `group:${groupId}:members`,
  groupStorage: (groupId: string) => `group:${groupId}:storage`,
  media: (mediaId: string) => `media:${mediaId}`,
  mediaByGroup: (groupId: string, page: number) => `media:group:${groupId}:page:${page}`,
  clustersByGroup: (groupId: string) => `clusters:group:${groupId}`,
  cluster: (clusterId: string) => `cluster:${clusterId}`,
  jobStatus: (jobId: string) => `job:${jobId}:status`,
};

// TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
};
