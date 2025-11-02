import { IFaceClusterRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { IFaceClusterMemberRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { IFaceDetectionRepository } from '../interfaces/repositories/IFaceDetectionRepository.js';
import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IStorageService } from '../interfaces/services/IStorageService.js';
import { NotFoundError } from '../../shared/errors/AppError.js';

export interface ClusterWithSample {
  id: string;
  clusterName?: string;
  appearanceCount: number;
  confidence: number;
  createdAt: Date;
  samplePhoto?: {
    s3Key: string;
    url: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  totalPhotos: number;
}

export class GetClustersWithSamplesUseCase {
  constructor(
    private readonly clusterRepository: IFaceClusterRepository,
    private readonly clusterMemberRepository: IFaceClusterMemberRepository,
    private readonly faceDetectionRepository: IFaceDetectionRepository,
    private readonly mediaRepository: IMediaRepository,
    private readonly groupRepository: IGroupRepository,
    private readonly storageService: IStorageService
  ) {}

  async execute(groupId: string, userId: string): Promise<ClusterWithSample[]> {
    // Verify user has access to the group
    const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
    if (!group) {
      throw new NotFoundError('Group not found or you do not have access');
    }

    // Get all clusters for this group
    const clustersResponse = await this.clusterRepository.findByGroupId(groupId);
    const clusters = clustersResponse.data;

    // For each cluster, get sample photo with best quality
    const clustersWithSamples = await Promise.all(
      clusters.map(async (cluster) => {
        // Get all members of this cluster
        const members = await this.clusterMemberRepository.findByClusterId(cluster.id);

        if (members.length === 0) {
          return {
            id: cluster.id,
            clusterName: cluster.clusterName,
            appearanceCount: cluster.appearanceCount,
            confidence: cluster.confidence,
            createdAt: cluster.createdAt,
            totalPhotos: 0,
          };
        }

        // Get all face detections for these members
        const faceDetectionIds = members.map(m => m.faceDetectionId);
        const faceDetections = await this.faceDetectionRepository.findByIds(faceDetectionIds);

        // Find best quality face (highest quality score)
        let bestFace = faceDetections[0];
        for (const face of faceDetections) {
          if (face.qualityScore && (!bestFace.qualityScore || face.qualityScore > bestFace.qualityScore)) {
            bestFace = face;
          }
        }

        // Get all unique media IDs
        const mediaIds = [...new Set(faceDetections.map(f => f.mediaId))];
        const totalPhotos = mediaIds.length;

        // Get the media item for the best face
        if (bestFace) {
          const media = await this.mediaRepository.findById(bestFace.mediaId);

          if (media) {
            // Generate presigned URL
            try {
              const presignedUrl = await this.storageService.getPresignedUrl(media.s3Key, 3600);

              return {
                id: cluster.id,
                clusterName: cluster.clusterName,
                appearanceCount: cluster.appearanceCount,
                confidence: cluster.confidence,
                createdAt: cluster.createdAt,
                samplePhoto: {
                  s3Key: media.s3Key,
                  url: presignedUrl,
                  boundingBox: bestFace.boundingBox,
                },
                totalPhotos,
              };
            } catch (error) {
              console.error(`Failed to generate presigned URL for cluster ${cluster.id}:`, error);
            }
          }
        }

        return {
          id: cluster.id,
          clusterName: cluster.clusterName,
          appearanceCount: cluster.appearanceCount,
          confidence: cluster.confidence,
          createdAt: cluster.createdAt,
          totalPhotos,
        };
      })
    );

    // Sort by appearance count (descending) then by creation date (descending)
    return clustersWithSamples.sort((a, b) => {
      if (b.appearanceCount !== a.appearanceCount) {
        return b.appearanceCount - a.appearanceCount;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }
}
