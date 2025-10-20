import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env.local");
dotenv.config({ path: envPath });

const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET_NAME) {
  console.error("Missing required AWS environment variables");
  process.exit(1);
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function setupCORS() {
  try {
    console.log(`Setting up CORS for S3 bucket: ${AWS_S3_BUCKET_NAME}`);

    const corsConfiguration = {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["GET", "HEAD"],
          AllowedOrigins: ["*"], // In production, replace with your domain
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000,
        },
      ],
    };

    const command = new PutBucketCorsCommand({
      Bucket: AWS_S3_BUCKET_NAME,
      CORSConfiguration: corsConfiguration,
    });

    await s3Client.send(command);

    console.log("✅ CORS configuration updated successfully!");
    console.log("\nCORS Rules:");
    console.log("- Allowed Methods: GET, HEAD");
    console.log("- Allowed Origins: * (all origins)");
    console.log("- Allowed Headers: * (all headers)");
    console.log("\n⚠️  For production, update AllowedOrigins to your specific domain!");
  } catch (error) {
    console.error("❌ Failed to setup CORS:", error);
    process.exit(1);
  }
}

setupCORS();
