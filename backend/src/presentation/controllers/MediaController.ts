import { Request, Response } from 'express';
import { UploadMediaUseCase } from '../../core/use-cases/UploadMediaUseCase.js';
import { IMediaRepository } from '../../core/interfaces/repositories/IMediaRepository.js';
import { IGroupRepository } from '../../core/interfaces/repositories/IGroupRepository.js';
import { IStorageService } from '../../core/interfaces/services/IStorageService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';
import { UploadedFile } from '../../shared/types/index.js';

export class MediaController {
  constructor(
    private uploadMediaUseCase: UploadMediaUseCase,
    private mediaRepository: IMediaRepository,
    private groupRepository: IGroupRepository,
    private storageService: IStorageService
  ) {}

  /**
   * Upload media files to a group
   * POST /api/groups/:groupId/upload
   */
  upload = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.groupId;

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new BadRequestError('No files uploaded');
    }

    // Convert multer files to UploadedFile format
    const files: UploadedFile[] = (req.files as Express.Multer.File[]).map(file => ({
      fieldname: file.fieldname,
      originalname: file.originalname,
      encoding: file.encoding,
      mimetype: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    }));

    const result = await this.uploadMediaUseCase.execute({
      groupId,
      userId,
      files,
    });

    return res.status(201).json({
      success: true,
      data: result.media,
      jobId: result.jobId,
      message: `Successfully uploaded ${result.media.length} file(s). Face detection job queued.`,
    });
  });

  /**
   * List media for a group
   * GET /api/groups/:groupId/media
   */
  listByGroup = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.groupId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Verify user is a member of the group
    const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
    if (!group) {
      throw new NotFoundError('Group not found or you do not have access');
    }

    const result = await this.mediaRepository.findByGroupId(groupId, { page, limit });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  });

  /**
   * Get a single media item by ID
   * GET /api/media/:id
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const mediaId = req.params.id;

    const media = await this.mediaRepository.findById(mediaId);
    if (!media) {
      throw new NotFoundError('Media not found');
    }

    // Verify user is a member of the group
    const group = await this.groupRepository.findByIdAndUserId(media.groupId, userId);
    if (!group) {
      throw new ForbiddenError('You do not have access to this media');
    }

    // Generate presigned URL for the media
    const presignedUrl = await this.storageService.getPresignedUrl(media.s3Key, 3600);

    return res.json({
      success: true,
      data: {
        ...media,
        presignedUrl,
      },
    });
  });

  /**
   * Delete a media item
   * DELETE /api/media/:id
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const mediaId = req.params.id;

    const media = await this.mediaRepository.findById(mediaId);
    if (!media) {
      throw new NotFoundError('Media not found');
    }

    // Verify user has permission to delete
    const group = await this.groupRepository.findByIdAndUserId(media.groupId, userId);
    if (!group) {
      throw new ForbiddenError('You do not have access to this group');
    }

    if (!group.canDelete(userId)) {
      throw new ForbiddenError('You do not have permission to delete media in this group');
    }

    // Delete from S3
    await this.storageService.deleteFile(media.s3Key);

    // Delete from database
    await this.mediaRepository.delete(mediaId);

    // Update group storage usage
    await this.groupRepository.updateStorageUsed(media.groupId, -media.fileSize);

    return res.json({
      success: true,
      message: 'Media deleted successfully',
    });
  });

  /**
   * Get download URL for media
   * GET /api/media/:id/download
   */
  getDownloadUrl = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const mediaId = req.params.id;

    const media = await this.mediaRepository.findById(mediaId);
    if (!media) {
      throw new NotFoundError('Media not found');
    }

    // Verify user is a member and has download permission
    const group = await this.groupRepository.findByIdAndUserId(media.groupId, userId);
    if (!group) {
      throw new ForbiddenError('You do not have access to this media');
    }

    if (!group.canDownload(userId)) {
      throw new ForbiddenError('You do not have permission to download media from this group');
    }

    // Generate presigned URL with longer expiration for downloads
    const downloadUrl = await this.storageService.getPresignedUrl(media.s3Key, 7200);

    return res.json({
      success: true,
      data: {
        url: downloadUrl,
        filename: media.originalName,
        expiresIn: 7200,
      },
    });
  });
}
