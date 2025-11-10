import { Media } from '../../entities/Media.js';
import { PaginationParams, PaginatedResponse } from '../../../shared/types/index.js';

export interface IMediaRepository {
  create(media: Media): Promise<Media>;
  createMany(media: Media[]): Promise<Media[]>;
  findById(id: string): Promise<Media | null>;
  findByGroupId(groupId: string, pagination?: PaginationParams): Promise<PaginatedResponse<Media>>;
  findByUploader(groupId: string, uploaderId: string): Promise<Media[]>;
  findUnprocessed(limit?: number): Promise<Media[]>;
  findByIds(ids: string[]): Promise<Media[]>;
  update(id: string, media: Partial<Media>): Promise<Media | null>;
  delete(id: string): Promise<boolean>;
  deleteByGroupId(groupId: string): Promise<number>;
  markAsProcessed(id: string): Promise<void>;
  getGroupStorageUsed(groupId: string): Promise<number>;
  countByGroupId(groupId: string): Promise<number>;

  // Cleanup methods
  findByGroupIdAndDate(groupId: string, startDate: Date | null, endDate: Date): Promise<Media[]>;
  findByGroupIdAndSize(groupId: string, minSize: number): Promise<Media[]>;
  findUnprocessedByGroupId(groupId: string): Promise<Media[]>;
}
