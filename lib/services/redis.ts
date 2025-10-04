import IORedis, { RedisOptions } from "ioredis";
import { config } from "@/lib/config/env";

const globalForRedis = globalThis as unknown as {
  redis: IORedis | undefined;
};

// Parse Redis URL and extract components
function parseRedisUrl(url: string): RedisOptions {
  try {
    const parsedUrl = new URL(url);
    const redisConfig: RedisOptions = {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port, 10) || 6379,
      password: parsedUrl.password || undefined,
      username: parsedUrl.username || undefined,
      db: parsedUrl.pathname ? parseInt(parsedUrl.pathname.slice(1), 10) : 0,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 60000,
      commandTimeout: 30000,
    };

    // Add TLS config for rediss:// URLs (Upstash uses TLS)
    if (parsedUrl.protocol === "rediss:") {
      redisConfig.tls = {};
    }

    return redisConfig;
  } catch (error) {
    console.error("Invalid REDIS_URL format:", error);
    throw new Error("Invalid REDIS_URL format");
  }
}

export const redis =
  globalForRedis.redis ?? new IORedis(parseRedisUrl(config.REDIS_URL));

if (config.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export default redis;
