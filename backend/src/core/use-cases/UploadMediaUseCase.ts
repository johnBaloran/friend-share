import { Media } from '../entities/Media.js';
import { IMediaRepository } from '../interfaces/repositories/IMediaRepository.js';
import { IGroupRepository } from '../interfaces/repositories/IGroupRepository.js';
import { IStorageService } from '../interfaces/services/IStorageService.js';
import { IQueueService } from '../interfaces/services/IQueueService.js';
import { NotFoundError, ForbiddenError, PayloadTooLargeError, BadRequestError } from '../../shared/errors/AppError.js';
import { JobType, QUEUE_NAMES } from '../../shared/constants/index.js';
import { UploadedFile } from '../../shared/types/index.js';

export interface UploadMediaDto {
  groupId: string;
  userId: string;
  files: UploadedFile[];
}

export class UploadMediaUseCase {
  constructor(
    private readonly mediaRepository: IMediaRepository,
    private readonly groupRepository: IGroupRepository,
    private readonly storageService: IStorageService,
    private readonly queueService: IQueueService
  ) {}

  async execute(dto: UploadMediaDto): Promise<{ media: Media[]; jobId: string }> {
    // Validate input
    if (!dto.groupId) {
      throw new BadRequestError('Group ID is required');
    }

    if (!dto.userId) {
      throw new BadRequestError('User ID is required');
    }

    if (!dto.files || dto.files.length === 0) {
      throw new BadRequestError('At least one file is required');
    }

    // Verify group exists and user is a member
    const group = await this.groupRepository.findById(dto.groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Check if user can upload
    if (!group.canUpload(dto.userId)) {
      throw new ForbiddenError('You do not have permission to upload to this group');
    }

    // Calculate total file size
    const totalSize = dto.files.reduce((sum, file) => sum + file.size, 0);

    // Check storage limit
    if (!group.hasStorageSpace(totalSize)) {
      throw new PayloadTooLargeError(
        `Not enough storage space. Available: ${(group.storageLimit - group.storageUsed) / 1024 / 1024}MB`
      );
    }

    // Validate file types
    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    for (const file of dto.files) {
      if (!validMimeTypes.includes(file.mimetype)) {
        throw new BadRequestError(`Invalid file type: ${file.mimetype}. Only images are allowed.`);
      }
    }

    // Upload files to S3 and create media records
    const mediaEntities: Media[] = [];
    const uploadPromises = dto.files.map(async (file) => {
      // Upload to S3
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.originalname}`;
      const uploadResult = await this.storageService.uploadFile(
        file.buffer,
        filename,
        dto.groupId,
        file.mimetype
      );

      // Create media entity
      const media = Media.create({
        groupId: dto.groupId,
        uploaderId: dto.userId,
        filename,
        originalName: file.originalname,
        s3Key: uploadResult.key,
        s3Bucket: uploadResult.bucket,
        url: uploadResult.url,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      mediaEntities.push(media);
      return media;
    });

    await Promise.all(uploadPromises);

    // Save media records to database
    const savedMedia = await this.mediaRepository.createMany(mediaEntities);

    // Update group storage usage
    await this.groupRepository.updateStorageUsed(dto.groupId, totalSize);

    // Queue face detection job
    const jobId = await this.queueService.addJob(
      QUEUE_NAMES.FACE_DETECTION,
      JobType.FACE_DETECTION,
      {
        groupId: dto.groupId,
        mediaIds: savedMedia.map(m => m.id),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }
    );

    return {
      media: savedMedia,
      jobId,
    };
  }
}
