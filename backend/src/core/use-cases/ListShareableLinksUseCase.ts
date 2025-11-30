import { ShareableLink, ResourceType } from '../entities/ShareableLink.js';
import { IShareableLinkRepository } from '../interfaces/repositories/IShareableLinkRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IFaceClusterRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';

interface ListShareableLinksDTO {
  resourceType: ResourceType;
  resourceId: string;
  userId: string;
}

export class ListShareableLinksUseCase {
  constructor(
    private shareableLinkRepository: IShareableLinkRepository,
    private groupRepository: IGroupRepository,
    private mediaRepository: IMediaRepository,
    private faceClusterRepository: IFaceClusterRepository
  ) {}

  async execute(dto: ListShareableLinksDTO): Promise<ShareableLink[]> {
    // Verify user has access to the resource
    await this.verifyAccess(dto.resourceType, dto.resourceId, dto.userId);

    // Get all active links for this resource
    return await this.shareableLinkRepository.findByResource(dto.resourceType, dto.resourceId);
  }

  private async verifyAccess(
    resourceType: ResourceType,
    resourceId: string,
    userId: string
  ): Promise<void> {
    switch (resourceType) {
      case 'group': {
        const group = await this.groupRepository.findByIdAndUserId(resourceId, userId);
        if (!group) {
          throw new NotFoundError('Group not found or you do not have access');
        }
        break;
      }

      case 'media': {
        const media = await this.mediaRepository.findById(resourceId);
        if (!media) {
          throw new NotFoundError('Media not found');
        }
        const group = await this.groupRepository.findByIdAndUserId(media.groupId, userId);
        if (!group) {
          throw new ForbiddenError('You do not have access to this media');
        }
        break;
      }

      case 'cluster': {
        const cluster = await this.faceClusterRepository.findById(resourceId);
        if (!cluster) {
          throw new NotFoundError('Cluster not found');
        }
        const group = await this.groupRepository.findByIdAndUserId(cluster.groupId, userId);
        if (!group) {
          throw new ForbiddenError('You do not have access to this cluster');
        }
        break;
      }

      default:
        throw new NotFoundError('Invalid resource type');
    }
  }
}
