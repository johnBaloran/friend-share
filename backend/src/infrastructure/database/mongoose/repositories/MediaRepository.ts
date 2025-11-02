import { IMediaRepository } from '../../../../core/interfaces/repositories/IMediaRepository.js';
import { Media } from '../../../../core/entities/Media.js';
import { MediaModel, IMediaDocument } from '../models/MediaModel.js';
import { PaginationParams, PaginatedResponse } from '../../../../shared/types/index.js';

export class MongoMediaRepository implements IMediaRepository {
  async create(media: Media): Promise<Media> {
    const doc = await MediaModel.create({
      groupId: media.groupId,
      uploaderId: media.uploaderId,
      filename: media.filename,
      originalName: media.originalName,
      s3Key: media.s3Key,
      s3Bucket: media.s3Bucket,
      url: media.url,
      mimeType: media.mimeType,
      fileSize: media.fileSize,
      width: media.width,
      height: media.height,
      processed: media.processed,
    });

    return this.toEntity(doc);
  }

  async createMany(mediaList: Media[]): Promise<Media[]> {
    const docs = await MediaModel.insertMany(
      mediaList.map(media => ({
        groupId: media.groupId,
        uploaderId: media.uploaderId,
        filename: media.filename,
        originalName: media.originalName,
        s3Key: media.s3Key,
        s3Bucket: media.s3Bucket,
        url: media.url,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        width: media.width,
        height: media.height,
        processed: media.processed,
      }))
    );

    return docs.map(doc => this.toEntity(doc as any));
  }

  async findById(id: string): Promise<Media | null> {
    const doc = await MediaModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByGroupId(
    groupId: string,
    pagination?: PaginationParams
  ): Promise<PaginatedResponse<Media>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      MediaModel.find({ groupId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MediaModel.countDocuments({ groupId }),
    ]);

    return {
      data: docs.map(doc => this.toEntity(doc)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findUnprocessed(limit: number = 100): Promise<Media[]> {
    const docs = await MediaModel.find({ processed: false })
      .sort({ createdAt: 1 })
      .limit(limit);

    return docs.map(doc => this.toEntity(doc));
  }

  async findByIds(ids: string[]): Promise<Media[]> {
    const docs = await MediaModel.find({ _id: { $in: ids } });
    return docs.map(doc => this.toEntity(doc));
  }

  async update(id: string, data: Partial<Media>): Promise<Media | null> {
    const doc = await MediaModel.findByIdAndUpdate(id, data, { new: true });
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await MediaModel.findByIdAndDelete(id);
    return !!result;
  }

  async deleteByGroupId(groupId: string): Promise<number> {
    const result = await MediaModel.deleteMany({ groupId });
    return result.deletedCount || 0;
  }

  async markAsProcessed(id: string): Promise<void> {
    await MediaModel.findByIdAndUpdate(id, { processed: true });
  }

  async getGroupStorageUsed(groupId: string): Promise<number> {
    const result = await MediaModel.aggregate([
      { $match: { groupId } },
      { $group: { _id: null, total: { $sum: '$fileSize' } } },
    ]);

    return result[0]?.total || 0;
  }

  async countByGroupId(groupId: string): Promise<number> {
    return MediaModel.countDocuments({ groupId });
  }

  // Cleanup methods
  async findByGroupIdAndDate(groupId: string, startDate: Date | null, endDate: Date): Promise<Media[]> {
    const query: any = {
      groupId,
      createdAt: { $lte: endDate },
    };

    if (startDate) {
      query.createdAt.$gte = startDate;
    }

    const docs = await MediaModel.find(query).sort({ createdAt: 1 });
    return docs.map(doc => this.toEntity(doc));
  }

  async findByGroupIdAndSize(groupId: string, minSize: number): Promise<Media[]> {
    const docs = await MediaModel.find({
      groupId,
      fileSize: { $gte: minSize },
    }).sort({ fileSize: -1 });

    return docs.map(doc => this.toEntity(doc));
  }

  async findUnprocessedByGroupId(groupId: string): Promise<Media[]> {
    const docs = await MediaModel.find({
      groupId,
      processed: false,
    }).sort({ createdAt: 1 });

    return docs.map(doc => this.toEntity(doc));
  }

  private toEntity(doc: IMediaDocument): Media {
    return new Media(
      (doc._id as any).toString(),
      (doc.groupId as any).toString(),
      (doc.uploaderId as any).toString(),
      doc.filename,
      doc.originalName,
      doc.s3Key,
      doc.s3Bucket,
      doc.url,
      doc.mimeType,
      doc.fileSize,
      doc.processed,
      doc.width,
      doc.height,
      doc.createdAt,
      doc.updatedAt
    );
  }
}
