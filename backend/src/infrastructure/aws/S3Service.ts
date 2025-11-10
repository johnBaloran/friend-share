import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { IStorageService } from '../../core/interfaces/services/IStorageService.js';
import { S3UploadResult } from '../../shared/types/index.js';
import { env } from '../../config/env.js';

export class S3Service implements IStorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: env.get('AWS_REGION'),
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucket = env.get('AWS_S3_BUCKET_NAME');
  }

  async uploadFile(
    buffer: Buffer,
    filename: string,
    groupId: string,
    contentType: string
  ): Promise<S3UploadResult> {
    const timestamp = Date.now();
    const key = `groups/${groupId}/${timestamp}-${filename}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: {
            groupId,
            uploadedAt: new Date().toISOString(),
          },
        })
      );

      const url = `https://${this.bucket}.s3.${env.get('AWS_REGION')}.amazonaws.com/${key}`;

      return {
        key,
        bucket: this.bucket,
        url,
      };
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw new Error(
        `Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<S3UploadResult> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      const url = `https://${this.bucket}.s3.${env.get('AWS_REGION')}.amazonaws.com/${key}`;

      console.log(`Uploaded buffer to S3: ${key}`);

      return {
        key,
        bucket: this.bucket,
        url,
      };
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw new Error(
        `Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      // @ts-ignore - Type mismatch between AWS SDK versions
      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error(`Failed to generate presigned URL for ${key}:`, error);
      throw error;
    }
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No body in S3 response');
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

  async getFileStream(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      // Return the stream directly
      return response.Body as Readable;
    } catch (error) {
      console.error(`Failed to get file stream for ${key}:`, error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      console.log(`Deleted S3 object: ${key}`);
    } catch (error) {
      console.error(`Failed to delete S3 object ${key}:`, error);
      throw error;
    }
  }

  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      // S3 allows max 1000 objects per delete request
      const batches: string[][] = [];
      for (let i = 0; i < keys.length; i += 1000) {
        batches.push(keys.slice(i, i + 1000));
      }

      for (const batch of batches) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: batch.map(key => ({ Key: key })),
              Quiet: true,
            },
          })
        );
      }

      console.log(`Bulk deleted ${keys.length} S3 objects`);
    } catch (error) {
      console.error('Bulk delete from S3 failed:', error);
      throw error;
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (error) {
      return false;
    }
  }
}
