import { ShareableLink, ResourceType, SharePermissions } from '../entities/ShareableLink.js';
import { IShareableLinkRepository } from '../interfaces/repositories/IShareableLinkRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IFaceClusterRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';

interface CreateShareableLinkDTO {
  resourceType: ResourceType;
  resourceId: string;
  userId: string;
  permissions: SharePermissions;
  expiresAt?: Date;
}

export class CreateShareableLinkUseCase {
  constructor(
    private shareableLinkRepository: IShareableLinkRepository,
    private groupRepository: IGroupRepository,
    private mediaRepository: IMediaRepository,
    private faceClusterRepository: IFaceClusterRepository
  ) {}

  async execute(dto: CreateShareableLinkDTO): Promise<ShareableLink> {
    // Validate input
    if (!dto.resourceType || !dto.resourceId || !dto.userId) {
      throw new BadRequestError('Missing required fields');
    }

    // Verify user has permission to share this resource
    await this.verifyPermissions(dto.resourceType, dto.resourceId, dto.userId);

    // Validate expiration date if provided
    if (dto.expiresAt && dto.expiresAt <= new Date()) {
      throw new BadRequestError('Expiration date must be in the future');
    }

    // Create the shareable link
    const link = ShareableLink.create({
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      createdBy: dto.userId,
      permissions: dto.permissions,
      expiresAt: dto.expiresAt,
    });

    return await this.shareableLinkRepository.create(link);
  }

  private async verifyPermissions(
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
        // Only admins can create shareable links for groups
        if (!group.isAdmin(userId)) {
          throw new ForbiddenError('Only group admins can create shareable links');
        }
        break;
      }

      case 'media': {
        const media = await this.mediaRepository.findById(resourceId);
        if (!media) {
          throw new NotFoundError('Media not found');
        }
        // Verify user is a member of the group
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
        // Verify user is a member of the group
        const group = await this.groupRepository.findByIdAndUserId(cluster.groupId, userId);
        if (!group) {
          throw new ForbiddenError('You do not have access to this cluster');
        }
        break;
      }

      default:
        throw new BadRequestError('Invalid resource type');
    }
  }
}
