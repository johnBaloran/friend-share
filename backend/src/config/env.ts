import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  API_PREFIX: z.string().default('/api'),

  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_S3_BUCKET_NAME: z.string().min(1, 'AWS_S3_BUCKET_NAME is required'),
  AWS_REKOGNITION_COLLECTION_PREFIX: z.string().default('face-media-group'),

  // Clerk
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // File Upload
  MAX_FILE_SIZE: z.string().default('10485760').transform(Number), // 10MB
  MAX_FILES_PER_UPLOAD: z.string().default('50').transform(Number),

  // Storage
  DEFAULT_STORAGE_LIMIT: z.string().default('1073741824').transform(Number), // 1GB
  DEFAULT_AUTO_DELETE_DAYS: z.string().default('30').transform(Number),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

type Env = z.infer<typeof envSchema>;

class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private readonly config: Env;

  private constructor() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error('❌ Invalid environment variables:');
      console.error(result.error.flatten().fieldErrors);
      throw new Error('Invalid environment variables');
    }

    this.config = result.data;
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  public get<K extends keyof Env>(key: K): Env[K] {
    return this.config[key];
  }

  public getAll(): Readonly<Env> {
    return Object.freeze({ ...this.config });
  }

  public isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  public isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }
}

export const env = EnvironmentConfig.getInstance();
export type { Env };
