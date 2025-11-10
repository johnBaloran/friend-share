import { IFaceDetectionRepository } from '../../../../core/interfaces/repositories/IFaceDetectionRepository.js';
import { FaceDetection } from '../../../../core/entities/FaceDetection.js';
import { FaceDetectionModel, IFaceDetectionDocument } from '../models/FaceDetectionModel.js';

export class MongoFaceDetectionRepository implements IFaceDetectionRepository {
  async create(faceDetection: FaceDetection): Promise<FaceDetection> {
    const doc = await FaceDetectionModel.create({
      mediaId: faceDetection.mediaId,
      rekognitionFaceId: faceDetection.rekognitionFaceId,
      boundingBox: faceDetection.boundingBox,
      confidence: faceDetection.confidence,
      quality: faceDetection.quality,
      pose: faceDetection.pose,
      qualityScore: faceDetection.qualityScore,
      enhancedFace: faceDetection.enhancedFace,
      thumbnailS3Key: faceDetection.thumbnailS3Key,
      processed: faceDetection.processed,
    });

    return this.toEntity(doc);
  }

  async createMany(faceDetections: FaceDetection[]): Promise<FaceDetection[]> {
    const docs = await FaceDetectionModel.insertMany(
      faceDetections.map(fd => ({
        mediaId: fd.mediaId,
        rekognitionFaceId: fd.rekognitionFaceId,
        boundingBox: fd.boundingBox,
        confidence: fd.confidence,
        quality: fd.quality,
        pose: fd.pose,
        qualityScore: fd.qualityScore,
        enhancedFace: fd.enhancedFace,
        thumbnailS3Key: fd.thumbnailS3Key,
        processed: fd.processed,
      }))
    );

    return docs.map(doc => this.toEntity(doc as any));
  }

  async findById(id: string): Promise<FaceDetection | null> {
    const doc = await FaceDetectionModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByIds(ids: string[]): Promise<FaceDetection[]> {
    const docs = await FaceDetectionModel.find({ _id: { $in: ids } });
    return docs.map(doc => this.toEntity(doc));
  }

  async findByMediaId(mediaId: string): Promise<FaceDetection[]> {
    const docs = await FaceDetectionModel.find({ mediaId });
    return docs.map(doc => this.toEntity(doc));
  }

  async findByMediaIds(mediaIds: string[]): Promise<FaceDetection[]> {
    const docs = await FaceDetectionModel.find({ mediaId: { $in: mediaIds } });
    return docs.map(doc => this.toEntity(doc));
  }

  async findByRekognitionFaceId(faceId: string): Promise<FaceDetection | null> {
    const doc = await FaceDetectionModel.findOne({ rekognitionFaceId: faceId });
    return doc ? this.toEntity(doc) : null;
  }

  async findUnprocessed(limit: number = 100): Promise<FaceDetection[]> {
    const docs = await FaceDetectionModel.find({ processed: false })
      .sort({ createdAt: 1 })
      .limit(limit);

    return docs.map(doc => this.toEntity(doc));
  }

  async update(id: string, data: Partial<FaceDetection>): Promise<FaceDetection | null> {
    const doc = await FaceDetectionModel.findByIdAndUpdate(id, data, { new: true });
    return doc ? this.toEntity(doc) : null;
  }

  async markAsProcessed(id: string): Promise<void> {
    await FaceDetectionModel.findByIdAndUpdate(id, { processed: true });
  }

  async markManyAsProcessed(ids: string[]): Promise<void> {
    await FaceDetectionModel.updateMany(
      { _id: { $in: ids } },
      { processed: true }
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await FaceDetectionModel.findByIdAndDelete(id);
    return !!result;
  }

  async deleteByMediaId(mediaId: string): Promise<number> {
    const result = await FaceDetectionModel.deleteMany({ mediaId });
    return result.deletedCount || 0;
  }

  async countByMediaId(mediaId: string): Promise<number> {
    return FaceDetectionModel.countDocuments({ mediaId });
  }

  private toEntity(doc: IFaceDetectionDocument): FaceDetection {
    return new FaceDetection(
      (doc._id as any).toString(),
      (doc.mediaId as any).toString(),
      doc.rekognitionFaceId,
      doc.boundingBox,
      doc.confidence,
      doc.processed,
      doc.quality,
      doc.pose,
      doc.qualityScore,
      doc.enhancedFace,
      doc.thumbnailS3Key,
      doc.createdAt,
      doc.updatedAt
    );
  }
}
