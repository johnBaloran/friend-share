import { Media } from '../entities/Media.js';
import { IFaceClusterRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { IFaceClusterMemberRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { IFaceDetectionRepository } from '../interfaces/repositories/IFaceDetectionRepository.js';
import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IStorageService } from '../interfaces/services/IStorageService.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';

export interface MediaWithFaceInfo extends Media {
  presignedUrl: string;
  faceDetections: Array<{
    id: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence: number;
  }>;
}

export interface ClusterMediaResult {
  media: MediaWithFaceInfo[];
  cluster: {
    id: string;
    clusterName?: string;
    appearanceCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class GetClusterMediaUseCase {
  constructor(
    private readonly clusterRepository: IFaceClusterRepository,
    private readonly clusterMemberRepository: IFaceClusterMemberRepository,
    private readonly faceDetectionRepository: IFaceDetectionRepository,
    private readonly mediaRepository: IMediaRepository,
    private readonly groupRepository: IGroupRepository,
    private readonly storageService: IStorageService
  ) {}

  async execute(
    clusterId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ClusterMediaResult> {
    // Get the cluster
    const cluster = await this.clusterRepository.findById(clusterId);
    if (!cluster) {
      throw new NotFoundError('Cluster not found');
    }

    // Verify user has access to the group
    const group = await this.groupRepository.findByIdAndUserId(cluster.groupId, userId);
    if (!group) {
      throw new ForbiddenError('You do not have access to this cluster');
    }

    // Get all members of this cluster
    const members = await this.clusterMemberRepository.findByClusterId(clusterId);
    const faceDetectionIds = members.map(m => m.faceDetectionId);

    // Get all face detections
    const faceDetections = await this.faceDetectionRepository.findByIds(faceDetectionIds);

    // Get unique media IDs
    const mediaIds = [...new Set(faceDetections.map(f => f.mediaId))];

    // Get media with pagination
    const mediaResult = await this.mediaRepository.findByIds(mediaIds);

    // Manual pagination since findByIds doesn't support it
    const total = mediaResult.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const paginatedMedia = mediaResult.slice(skip, skip + limit);

    // Attach face detection info to each media item and generate presigned URLs
    const mediaWithFaces: MediaWithFaceInfo[] = await Promise.all(
      paginatedMedia.map(async (item) => {
        const itemFaceDetections = faceDetections
          .filter(detection => detection.mediaId === item.id)
          .map(detection => ({
            id: detection.id,
            boundingBox: detection.boundingBox,
            confidence: detection.confidence,
          }));

        try {
          const presignedUrl = await this.storageService.getPresignedUrl(item.s3Key, 3600);

          return {
            id: item.id,
            groupId: item.groupId,
            uploaderId: item.uploaderId,
            filename: item.filename,
            originalName: item.originalName,
            s3Key: item.s3Key,
            s3Bucket: item.s3Bucket,
            url: item.url,
            mimeType: item.mimeType,
            fileSize: item.fileSize,
            isProcessed: item.processed,
            width: item.width,
            height: item.height,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            presignedUrl,
            faceDetections: itemFaceDetections,
          } as any;
        } catch (error) {
          console.error(`Failed to generate presigned URL for ${item.s3Key}:`, error);

          return {
            id: item.id,
            groupId: item.groupId,
            uploaderId: item.uploaderId,
            filename: item.filename,
            originalName: item.originalName,
            s3Key: item.s3Key,
            s3Bucket: item.s3Bucket,
            url: item.url,
            mimeType: item.mimeType,
            fileSize: item.fileSize,
            isProcessed: item.processed,
            width: item.width,
            height: item.height,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            presignedUrl: '',
            faceDetections: itemFaceDetections,
          } as any;
        }
      })
    );

    return {
      media: mediaWithFaces,
      cluster: {
        id: cluster.id,
        clusterName: cluster.clusterName,
        appearanceCount: cluster.appearanceCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
