import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { config } from "@/lib/config/env";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  contentType: string;
}

// Singleton client instance
let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

/**
 * Upload media file to S3
 */
export async function uploadMedia(
  buffer: Buffer,
  filename: string,
  groupId: string,
  contentType: string
): Promise<S3UploadResult> {
  const s3Client = getClient();
  const timestamp = Date.now();
  const key = `groups/${groupId}/${timestamp}-${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        groupId,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    // Construct the URL
    const url = `https://${config.AWS_S3_BUCKET_NAME}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;

    return {
      key,
      url,
      bucket: config.AWS_S3_BUCKET_NAME,
      size: buffer.length,
      contentType,
    };
  } catch (error) {
    console.error("S3 upload failed:", error);
    throw new Error(
      `Failed to upload to S3: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Delete a single media file from S3
 */
export async function deleteMedia(key: string): Promise<void> {
  const s3Client = getClient();

  try {
    const command = new DeleteObjectCommand({
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`Deleted S3 object: ${key}`);
  } catch (error) {
    console.error(`Failed to delete S3 object ${key}:`, error);
    throw error;
  }
}

/**
 * Bulk delete multiple media files from S3
 */
export async function bulkDelete(keys: string[], bucket?: string): Promise<void> {
  if (keys.length === 0) return;

  const s3Client = getClient();
  const bucketName = bucket || config.AWS_S3_BUCKET_NAME;

  try {
    // S3 allows max 1000 objects per delete request
    const batches: string[][] = [];
    for (let i = 0; i < keys.length; i += 1000) {
      batches.push(keys.slice(i, i + 1000));
    }

    for (const batch of batches) {
      const command = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      });

      await s3Client.send(command);
    }

    console.log(`Bulk deleted ${keys.length} S3 objects`);
  } catch (error) {
    console.error("Bulk delete from S3 failed:", error);
    throw error;
  }
}

/**
 * Get a presigned URL for temporary access to a media file
 */
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const s3Client = getClient();

  try {
    const command = new GetObjectCommand({
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error(`Failed to generate presigned URL for ${key}:`, error);
    throw error;
  }
}

/**
 * Check if an object exists in S3
 */
export async function objectExists(key: string): Promise<boolean> {
  const s3Client = getClient();

  try {
    const command = new HeadObjectCommand({
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get object metadata
 */
export async function getObjectMetadata(key: string): Promise<{
  size: number;
  contentType: string;
  lastModified: Date;
} | null> {
  const s3Client = getClient();

  try {
    const command = new HeadObjectCommand({
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);

    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || "application/octet-stream",
      lastModified: response.LastModified || new Date(),
    };
  } catch (error) {
    console.error(`Failed to get metadata for ${key}:`, error);
    return null;
  }
}

/**
 * Get object as buffer (for Rekognition processing)
 */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const s3Client = getClient();

  try {
    const command = new GetObjectCommand({
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error("No body in S3 response");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error(`Failed to get object buffer for ${key}:`, error);
    throw error;
  }
}
