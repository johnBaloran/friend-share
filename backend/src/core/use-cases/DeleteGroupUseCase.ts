import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IFaceDetectionRepository } from '../interfaces/repositories/IFaceDetectionRepository.js';
import { IFaceClusterRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { IStorageService } from '../interfaces/services/IStorageService.js';
import { IFaceRecognitionService } from '../interfaces/services/IFaceRecognitionService.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';

/**
 * DeleteGroupUseCase
 *
 * Follows Single Responsibility Principle:
 * - Only responsible for coordinating group deletion
 * - Delegates cleanup to appropriate repositories and services
 *
 * Follows Dependency Inversion Principle:
 * - Depends on abstractions (interfaces), not concrete implementations
 *
 * Cleanup Process:
 * 1. Verify user authorization (must be group creator)
 * 2. Delete AWS Rekognition collection
 * 3. Delete all S3 objects (media files and thumbnails)
 * 4. Delete all database records (cascading):
 *    - Face cluster members
 *    - Face clusters
 *    - Face detections
 *    - Media
 *    - Group
 */

export interface DeleteGroupDTO {
  groupId: string;
  userId: string;
}

export class DeleteGroupUseCase {
  constructor(
    private groupRepository: IGroupRepository,
    private mediaRepository: IMediaRepository,
    private faceDetectionRepository: IFaceDetectionRepository,
    private faceClusterRepository: IFaceClusterRepository,
    private storageService: IStorageService,
    private faceRecognitionService: IFaceRecognitionService
  ) {}

  async execute(dto: DeleteGroupDTO): Promise<void> {
    // Fetch group
    const group = await this.groupRepository.findById(dto.groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Authorization: Only group creator can delete the group
    if (group.creatorId !== dto.userId) {
      throw new ForbiddenError('Only the group creator can delete the group');
    }

    console.log(`[DeleteGroup] Starting deletion of group ${dto.groupId} by user ${dto.userId}`);

    try {
      // Step 1: Delete AWS Rekognition collection (if exists)
      await this.deleteRekognitionCollection(group.rekognitionCollectionId);

      // Step 2: Delete all S3 objects (media files and thumbnails)
      await this.deleteS3Objects(dto.groupId);

      // Step 3: Delete database records in correct order (foreign key constraints)
      await this.deleteDatabaseRecords(dto.groupId);

      // Step 4: Delete the group itself
      const deleted = await this.groupRepository.delete(dto.groupId);
      if (!deleted) {
        throw new Error('Failed to delete group from database');
      }

      console.log(`[DeleteGroup] Successfully deleted group ${dto.groupId}`);
    } catch (error) {
      console.error(`[DeleteGroup] Failed to delete group ${dto.groupId}:`, error);
      throw error;
    }
  }

  private async deleteRekognitionCollection(collectionId?: string): Promise<void> {
    if (!collectionId) {
      console.log('[DeleteGroup] No Rekognition collection to delete');
      return;
    }

    try {
      await this.faceRecognitionService.deleteCollection(collectionId);
      console.log(`[DeleteGroup] Deleted Rekognition collection: ${collectionId}`);
    } catch (error) {
      // Log but don't fail if collection doesn't exist
      console.warn(`[DeleteGroup] Failed to delete Rekognition collection ${collectionId}:`, error);
    }
  }

  private async deleteS3Objects(groupId: string): Promise<void> {
    try {
      // Get all media for the group
      const media = await this.mediaRepository.findByGroupId(groupId);
      console.log(`[DeleteGroup] Found ${media.length} media files to delete from S3`);

      if (media.length === 0) {
        console.log('[DeleteGroup] No media files to delete from S3');
        return;
      }

      // Collect all S3 keys (media files)
      const s3Keys = media.map(m => m.s3Key);

      // Get all face detections to collect thumbnail keys
      const allFaceDetections = await Promise.all(
        media.map(m => this.faceDetectionRepository.findByMediaId(m.id))
      );
      const thumbnailKeys = allFaceDetections
        .flat()
        .filter(fd => fd.thumbnailS3Key)
        .map(fd => fd.thumbnailS3Key!);

      // Combine all keys
      const allKeys = [...s3Keys, ...thumbnailKeys];
      console.log(`[DeleteGroup] Deleting ${allKeys.length} S3 objects (${s3Keys.length} media + ${thumbnailKeys.length} thumbnails)`);

      // Delete all files in batch
      if (allKeys.length > 0) {
        await this.storageService.deleteFiles(allKeys);
        console.log(`[DeleteGroup] Deleted all S3 objects`);
      }
    } catch (error) {
      console.error('[DeleteGroup] Error deleting S3 objects:', error);
      // Continue with deletion even if S3 cleanup fails
    }
  }

  private async deleteDatabaseRecords(groupId: string): Promise<void> {
    console.log(`[DeleteGroup] Deleting database records for group ${groupId}`);

    try {
      // Delete in correct order to respect foreign key constraints:

      // 1. Delete face cluster members and clusters (references face detections and group)
      const clustersDeleted = await this.faceClusterRepository.deleteByGroupId(groupId);
      console.log(`[DeleteGroup] Deleted ${clustersDeleted} face clusters and their members`);

      // 2. Delete face detections (references media)
      // Get all media first, then delete face detections for each media
      const media = await this.mediaRepository.findByGroupId(groupId);
      let faceDetectionsDeleted = 0;
      for (const m of media) {
        const count = await this.faceDetectionRepository.deleteByMediaId(m.id);
        faceDetectionsDeleted += count;
      }
      console.log(`[DeleteGroup] Deleted ${faceDetectionsDeleted} face detections`);

      // 3. Delete media (references group)
      const mediaDeleted = await this.mediaRepository.deleteByGroupId(groupId);
      console.log(`[DeleteGroup] Deleted ${mediaDeleted} media records`);

    } catch (error) {
      console.error('[DeleteGroup] Error deleting database records:', error);
      throw error;
    }
  }
}
