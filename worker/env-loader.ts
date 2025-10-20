// This file must be imported first to load environment variables
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

// Load .env.local file
const result = dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

if (result.error) {
  console.warn("Warning: Could not load .env.local file:", result.error.message);
}

// Re-export for debugging
export const envLoaded = true;
