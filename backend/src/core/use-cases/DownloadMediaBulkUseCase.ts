import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AppError.js';

export interface DownloadMediaBulkInput {
  userId: string;
  groupId: string;
  mediaIds: string[];
}

export interface MediaDownloadInfo {
  id: string;
  s3Key: string;
  originalName: string;
}

export class DownloadMediaBulkUseCase {
  constructor(
    private mediaRepository: IMediaRepository,
    private groupRepository: IGroupRepository
  ) {}

  async execute(input: DownloadMediaBulkInput): Promise<MediaDownloadInfo[]> {
    const { userId, groupId, mediaIds } = input;

    // Validate input
    if (!mediaIds || mediaIds.length === 0) {
      throw new BadRequestError('No media IDs provided');
    }

    if (mediaIds.length > 500) {
      throw new BadRequestError('Cannot download more than 500 files at once');
    }

    // Verify user has access to the group
    const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
    if (!group) {
      throw new NotFoundError('Group not found or you do not have access');
    }

    // Check download permissions
    if (!group.canDownload(userId)) {
      throw new ForbiddenError('You do not have permission to download media from this group');
    }

    // Fetch all media items
    const mediaItems = await this.mediaRepository.findByIds(mediaIds);

    // Verify all media belongs to the specified group
    const invalidMedia = mediaItems.filter((media) => media.groupId !== groupId);
    if (invalidMedia.length > 0) {
      throw new ForbiddenError('Some media items do not belong to the specified group');
    }

    if (mediaItems.length === 0) {
      throw new NotFoundError('No media items found');
    }

    // Return media info for download
    return mediaItems.map((media) => ({
      id: media.id,
      s3Key: media.s3Key,
      originalName: media.originalName,
    }));
  }
}
