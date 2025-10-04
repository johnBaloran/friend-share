import { z } from "zod";

const envSchema = z.object({
  // Database
  MONGODB_URI: z.string().url(),

  // Clerk Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),

  // Azure Face API
  AZURE_FACE_API_KEY: z.string(),
  AZURE_FACE_ENDPOINT: z.string().url(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),

  // Redis
  // REDIS_URL: z.string().url(),

  // App Settings
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  MAX_FILE_SIZE: z
    .string()
    .default("10485760")
    .transform((val) => parseInt(val, 10)),
  MAX_FILES_PER_UPLOAD: z
    .string()
    .default("50")
    .transform((val) => parseInt(val, 10)),

  // Production Settings
  ENABLE_RATE_LIMITING: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  ENABLE_PERFORMANCE_MONITORING: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  // Error Tracking (optional)
  SENTRY_DSN: z.string().optional(),

  // Analytics (optional)
  GOOGLE_ANALYTICS_ID: z.string().optional(),
});

function parseEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error("Invalid environment variables:", error);

    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }

    // In development, provide fallbacks where possible
    return envSchema.parse({
      ...process.env,
      ENABLE_RATE_LIMITING: "false",
      ENABLE_PERFORMANCE_MONITORING: "true",
    });
  }
}

export const config = parseEnv();
export type Config = z.infer<typeof envSchema>;

// Runtime configuration helpers
export const isDevelopment = config.NODE_ENV === "development";
export const isProduction = config.NODE_ENV === "production";
export const isTest = config.NODE_ENV === "test";
