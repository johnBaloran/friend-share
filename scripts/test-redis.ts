import IORedis from "ioredis";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables from .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  console.log("📄 Loading environment from .env.local");
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log("📄 Loading environment from .env");
  dotenv.config({ path: envPath });
} else {
  console.log("⚠️  No .env or .env.local file found");
}

async function testRedisConnection() {
  console.log("🔍 Testing Redis connection to Upstash...\n");

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.error("❌ Error: REDIS_URL not found in environment variables");
    console.log("\n📝 Please add REDIS_URL to your .env.local or .env file");
    console.log("   Format: rediss://default:PASSWORD@your-instance.upstash.io:6379\n");
    process.exit(1);
  }

  console.log("📍 Redis URL found:", redisUrl.replace(/:[^:@]+@/, ":****@"));

  let redis: IORedis | null = null;

  try {
    const parsedUrl = new URL(redisUrl);

    redis = new IORedis({
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port, 10) || 6379,
      password: parsedUrl.password || undefined,
      username: parsedUrl.username || "default",
      tls: parsedUrl.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null,
      connectTimeout: 10000,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    console.log("\n⏳ Connecting to Redis...");

    // Wait for connection with timeout
    await Promise.race([
      new Promise((resolve) => {
        redis!.on("connect", resolve);
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout after 10 seconds")), 10000)
      ),
    ]);

    console.log("✅ Successfully connected to Redis!");

    // Test basic operations
    console.log("\n🧪 Testing basic Redis operations...");

    // Set a test key
    await redis.set("test:connection", "success", "EX", 60);
    console.log("✅ SET operation successful");

    // Get the test key
    const value = await redis.get("test:connection");
    console.log(`✅ GET operation successful (value: ${value})`);

    // Test ping
    const pong = await redis.ping();
    console.log(`✅ PING successful (response: ${pong})`);

    // Get Redis info
    const info = await redis.info("server");
    const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log(`✅ Redis version: ${redisVersion}`);

    // Clean up
    await redis.del("test:connection");
    console.log("✅ Cleanup successful");

    console.log("\n🎉 All tests passed! Redis is working correctly.\n");

    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Redis connection failed:");

    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);

      if (error.message.includes("ENOTFOUND")) {
        console.log("\n💡 This usually means:");
        console.log("   1. The Redis hostname is incorrect");
        console.log("   2. The Redis instance was deleted");
        console.log("   3. Network/DNS issues");
        console.log("\n   → Check your Upstash dashboard to verify the instance exists");
      } else if (error.message.includes("ECONNREFUSED")) {
        console.log("\n💡 Connection refused - check if:");
        console.log("   1. The port number is correct (usually 6379)");
        console.log("   2. The instance is running");
      } else if (error.message.includes("NOAUTH") || error.message.includes("invalid password")) {
        console.log("\n💡 Authentication failed - check if:");
        console.log("   1. The password in REDIS_URL is correct");
        console.log("   2. You copied the full connection string from Upstash");
      }
    }

    console.log();

    if (redis) {
      await redis.quit();
    }

    process.exit(1);
  }
}

testRedisConnection();
