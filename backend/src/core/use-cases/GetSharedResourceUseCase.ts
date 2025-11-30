import { IShareableLinkRepository } from '../interfaces/repositories/IShareableLinkRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IFaceClusterRepository, IFaceClusterMemberRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { IFaceDetectionRepository } from '../interfaces/repositories/IFaceDetectionRepository.js';
import { IStorageService } from '../interfaces/services/IStorageService.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';
import { Group } from '../entities/Group.js';
import { Media } from '../entities/Media.js';
import { FaceCluster } from '../entities/FaceCluster.js';

interface SharedResource {
  link: {
    id: string;
    resourceType: string;
    permissions: {
      canView: boolean;
      canDownload: boolean;
    };
    expiresAt: Date | null;
  };
  resource: any; // Group, Media, or Cluster data
  media?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    presignedUrl: string;
    createdAt: Date;
  }>;
  clusters?: Array<{
    id: string;
    clusterName: string | null;
    appearanceCount: number;
    sampleImageUrl: string | null;
  }>;
}

export class GetSharedResourceUseCase {
  constructor(
    private shareableLinkRepository: IShareableLinkRepository,
    private groupRepository: IGroupRepository,
    private mediaRepository: IMediaRepository,
    private faceClusterRepository: IFaceClusterRepository,
    private faceClusterMemberRepository: IFaceClusterMemberRepository,
    private faceDetectionRepository: IFaceDetectionRepository,
    private storageService: IStorageService
  ) {}

  async execute(token: string): Promise<SharedResource> {
    // Find the shareable link
    const link = await this.shareableLinkRepository.findByToken(token);

    if (!link) {
      throw new NotFoundError('Share link not found');
    }

    // Validate the link
    if (!link.isValid()) {
      if (link.isExpired()) {
        throw new ForbiddenError('This share link has expired');
      }
      throw new ForbiddenError('This share link is no longer active');
    }

    // Increment access count
    await this.shareableLinkRepository.incrementAccessCount(link.id);

    // Get the resource data based on type
    let resource: any;
    let media: any[] = [];
    let clusters: any[] | undefined;

    switch (link.resourceType) {
      case 'group': {
        const group = await this.groupRepository.findById(link.resourceId);
        if (!group) {
          throw new NotFoundError('Group not found');
        }

        resource = this.formatGroup(group);

        // Get all media in the group
        const mediaResult = await this.mediaRepository.findByGroupId(link.resourceId, {
          page: 1,
          limit: 1000, // TODO: Add pagination for large groups
        });

        media = await this.formatMediaList(mediaResult.data);

        // Get face clusters for the group
        clusters = await this.getGroupClusters(link.resourceId);
        break;
      }

      case 'media': {
        const mediaItem = await this.mediaRepository.findById(link.resourceId);
        if (!mediaItem) {
          throw new NotFoundError('Media not found');
        }

        resource = await this.formatMedia(mediaItem);
        media = [resource];
        break;
      }

      case 'cluster': {
        const cluster = await this.faceClusterRepository.findById(link.resourceId);
        if (!cluster) {
          throw new NotFoundError('Cluster not found');
        }

        resource = this.formatCluster(cluster);

        // Get all media for this cluster
        const clusterMembers = await this.faceClusterMemberRepository.findByClusterId(link.resourceId);
        const faceDetectionIds = clusterMembers.map(m => m.faceDetectionId);

        if (faceDetectionIds.length > 0) {
          const faceDetections = await this.faceDetectionRepository.findByIds(faceDetectionIds);
          const mediaIds = [...new Set(faceDetections.map(fd => fd.mediaId))];

          if (mediaIds.length > 0) {
            const mediaItems = await this.mediaRepository.findByIds(mediaIds);
            media = await this.formatMediaList(mediaItems);
          }
        }
        break;
      }

      default:
        throw new NotFoundError('Invalid resource type');
    }

    return {
      link: {
        id: link.id,
        resourceType: link.resourceType,
        permissions: link.permissions,
        expiresAt: link.expiresAt,
      },
      resource,
      media,
      clusters,
    };
  }

  private async getGroupClusters(groupId: string) {
    try {
      // Get all clusters for the group
      const clustersResult = await this.faceClusterRepository.findByGroupId(groupId, {
        page: 1,
        limit: 100, // Get up to 100 clusters
      });

      // For each cluster, get a sample image
      const clustersWithSamples = await Promise.all(
        clustersResult.data.map(async (cluster: any) => {
          let sampleImageUrl: string | null = null;

          // Get first face detection for this cluster
          const members = await this.faceClusterMemberRepository.findByClusterId(cluster.id);
          if (members.length > 0) {
            const firstMember = members[0];
            const faceDetection = await this.faceDetectionRepository.findById(firstMember.faceDetectionId);

            if (faceDetection && faceDetection.thumbnailS3Key) {
              sampleImageUrl = await this.storageService.getPresignedUrl(faceDetection.thumbnailS3Key, 3600);
            }
          }

          return {
            id: cluster.id,
            clusterName: cluster.clusterName || null,
            appearanceCount: cluster.appearanceCount,
            sampleImageUrl,
          };
        })
      );

      return clustersWithSamples;
    } catch (error) {
      console.error('Failed to load clusters for shared group:', error);
      return [];
    }
  }

  private formatGroup(group: Group) {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      memberCount: group.members.length,
      createdAt: group.createdAt,
    };
  }

  private async formatMedia(media: Media) {
    return {
      id: media.id,
      originalName: media.originalName,
      mimeType: media.mimeType,
      fileSize: media.fileSize,
      presignedUrl: await this.storageService.getPresignedUrl(media.s3Key, 3600),
      createdAt: media.createdAt,
    };
  }

  private async formatMediaList(mediaList: Media[]) {
    return Promise.all(
      mediaList.map(async (media) => ({
        id: media.id,
        originalName: media.originalName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        presignedUrl: await this.storageService.getPresignedUrl(media.s3Key, 3600),
        createdAt: media.createdAt,
      }))
    );
  }

  private formatCluster(cluster: FaceCluster) {
    return {
      id: cluster.id,
      clusterName: cluster.clusterName || 'Unnamed Person',
      appearanceCount: cluster.appearanceCount,
      createdAt: cluster.createdAt,
    };
  }
}
