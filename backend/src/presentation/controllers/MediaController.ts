import { Request, Response } from 'express';
import archiver from 'archiver';
import { UploadMediaUseCase } from '../../core/use-cases/UploadMediaUseCase.js';
import { DownloadMediaBulkUseCase } from '../../core/use-cases/DownloadMediaBulkUseCase.js';
import { IMediaRepository } from '../../core/interfaces/repositories/IMediaRepository.js';
import { IGroupRepository } from '../../core/interfaces/repositories/IGroupRepository.js';
import { IStorageService } from '../../core/interfaces/services/IStorageService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';
import { UploadedFile } from '../../shared/types/index.js';
import { RedisCacheService, CacheKeys, CacheTTL } from '../../infrastructure/cache/RedisCacheService.js';

export class MediaController {
  private downloadMediaBulkUseCase: DownloadMediaBulkUseCase;

  constructor(
    private uploadMediaUseCase: UploadMediaUseCase,
    private mediaRepository: IMediaRepository,
    private groupRepository: IGroupRepository,
    private storageService: IStorageService,
    private cacheService: RedisCacheService
  ) {
    this.downloadMediaBulkUseCase = new DownloadMediaBulkUseCase(
      mediaRepository,
      groupRepository
    );
  }

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

    // Invalidate media list cache for this group
    await this.cacheService.deletePattern(`media:group:${groupId}:page:*`);
    await this.cacheService.delete(CacheKeys.groupStorage(groupId));

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

    // Cache media list (5 min TTL - fresher data for media updates)
    const cacheKey = CacheKeys.mediaByGroup(groupId, page);
    const result = await this.cacheService.wrap(
      cacheKey,
      async () => this.mediaRepository.findByGroupId(groupId, { page, limit }),
      CacheTTL.SHORT
    );

    // Generate presigned URLs for each media item (don't cache URLs as they expire)
    const mediaWithUrls = await Promise.all(
      result.data.map(async (media) => ({
        id: media.id,
        groupId: media.groupId,
        uploaderId: media.uploaderId,
        originalName: media.originalName,
        fileSize: media.fileSize,
        mimeType: media.mimeType,
        isProcessed: media.processed,
        createdAt: media.createdAt,
        presignedUrl: await this.storageService.getPresignedUrl(media.s3Key, 3600),
      }))
    );

    return res.json({
      success: true,
      data: mediaWithUrls,
      pagination: result.pagination,
    });
  });

  /**
   * Proxy S3 images through backend (for CORS-free canvas access)
   * GET /api/media/proxy?key=...
   */
  proxy = asyncHandler(async (req: Request, res: Response) => {
    const key = req.query.key as string;

    if (!key) {
      throw new BadRequestError('Missing key parameter');
    }

    try {
      // Get the file from S3
      const buffer = await this.storageService.getObjectBuffer(key);

      // Set appropriate headers
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*', // Allow from any origin
      });

      return res.send(buffer);
    } catch (error) {
      console.error(`Proxy failed for key ${key}:`, error);
      throw new NotFoundError('Image not found');
    }
  });

  /**
   * Get a single media item by ID
   * GET /api/media/:id
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const mediaId = req.params.id;

    // Cache media metadata (30 min TTL)
    const media = await this.cacheService.wrap(
      CacheKeys.media(mediaId),
      async () => this.mediaRepository.findById(mediaId),
      CacheTTL.MEDIUM
    );

    if (!media) {
      throw new NotFoundError('Media not found');
    }

    // Verify user is a member of the group
    const group = await this.groupRepository.findByIdAndUserId(media.groupId, userId);
    if (!group) {
      throw new ForbiddenError('You do not have access to this media');
    }

    // Generate presigned URL for the media (don't cache URLs as they expire)
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

    // Invalidate caches
    await this.cacheService.delete(CacheKeys.media(mediaId));
    await this.cacheService.deletePattern(`media:group:${media.groupId}:page:*`);
    await this.cacheService.delete(CacheKeys.groupStorage(media.groupId));

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

  /**
   * Bulk download media as ZIP
   * POST /api/groups/:groupId/media/download-bulk
   */
  bulkDownload = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.groupId;
    const { mediaIds } = req.body;

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      throw new BadRequestError('mediaIds array is required');
    }

    // Get media info and verify permissions
    const mediaItems = await this.downloadMediaBulkUseCase.execute({
      userId,
      groupId,
      mediaIds,
    });

    // Set response headers for ZIP download
    const zipFilename = `photos_${groupId}_${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 6 }, // Compression level (0-9)
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      throw err;
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add each file to the archive
    for (const media of mediaItems) {
      try {
        // Get file stream from S3
        const fileStream = await this.storageService.getFileStream(media.s3Key);

        // Add file to archive with original name
        // Use a counter if there are duplicate filenames
        const filename = media.originalName;
        archive.append(fileStream, { name: filename });
      } catch (error) {
        console.error(`Failed to add ${media.originalName} to archive:`, error);
        // Continue with other files
      }
    }

    // Finalize the archive
    await archive.finalize();

    console.log(`✅ Bulk download: ${mediaItems.length} files sent to user ${userId}`);
  });
}
