import { S3UploadResult } from '../../../shared/types/index.js';
import { Readable } from 'stream';

export interface IStorageService {
  uploadFile(
    buffer: Buffer,
    filename: string,
    groupId: string,
    contentType: string
  ): Promise<S3UploadResult>;

  uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<S3UploadResult>;

  getPresignedUrl(key: string, expiresIn?: number): Promise<string>;

  getObjectBuffer(key: string): Promise<Buffer>;

  getFileStream(key: string): Promise<Readable>;

  deleteFile(key: string): Promise<void>;

  deleteFiles(keys: string[]): Promise<void>;

  fileExists(key: string): Promise<boolean>;
}
