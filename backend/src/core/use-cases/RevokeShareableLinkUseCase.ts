import { IShareableLinkRepository } from '../interfaces/repositories/IShareableLinkRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IFaceClusterRepository } from '../interfaces/repositories/IFaceClusterRepository.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';

interface RevokeShareableLinkDTO {
  linkId: string;
  userId: string;
}

export class RevokeShareableLinkUseCase {
  constructor(
    private shareableLinkRepository: IShareableLinkRepository,
    private groupRepository: IGroupRepository,
    private mediaRepository: IMediaRepository,
    private faceClusterRepository: IFaceClusterRepository
  ) {}

  async execute(dto: RevokeShareableLinkDTO): Promise<void> {
    const link = await this.shareableLinkRepository.findById(dto.linkId);

    if (!link) {
      throw new NotFoundError('Share link not found');
    }

    // Verify user has permission to revoke this link
    // Either the creator or a group admin can revoke
    if (link.createdBy !== dto.userId) {
      // Check if user is admin of the resource's group
      let groupId: string | undefined;

      switch (link.resourceType) {
        case 'group':
          groupId = link.resourceId;
          break;

        case 'media': {
          const media = await this.mediaRepository.findById(link.resourceId);
          groupId = media?.groupId;
          break;
        }

        case 'cluster': {
          const cluster = await this.faceClusterRepository.findById(link.resourceId);
          groupId = cluster?.groupId;
          break;
        }
      }

      if (!groupId) {
        throw new NotFoundError('Resource not found');
      }

      const group = await this.groupRepository.findByIdAndUserId(groupId, dto.userId);
      if (!group || !group.isAdmin(dto.userId)) {
        throw new ForbiddenError('Only the creator or group admin can revoke this link');
      }
    }

    // Revoke the link
    const revokedLink = link.revoke();
    await this.shareableLinkRepository.update(dto.linkId, revokedLink);
  }
}
