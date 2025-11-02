import { FaceDetection } from '../../entities/FaceDetection.js';

export interface IFaceDetectionRepository {
  create(faceDetection: FaceDetection): Promise<FaceDetection>;
  createMany(faceDetections: FaceDetection[]): Promise<FaceDetection[]>;
  findById(id: string): Promise<FaceDetection | null>;
  findByIds(ids: string[]): Promise<FaceDetection[]>;
  findByMediaId(mediaId: string): Promise<FaceDetection[]>;
  findByMediaIds(mediaIds: string[]): Promise<FaceDetection[]>;
  findByRekognitionFaceId(faceId: string): Promise<FaceDetection | null>;
  findUnprocessed(limit?: number): Promise<FaceDetection[]>;
  update(id: string, data: Partial<FaceDetection>): Promise<FaceDetection | null>;
  markAsProcessed(id: string): Promise<void>;
  markManyAsProcessed(ids: string[]): Promise<void>;
  delete(id: string): Promise<boolean>;
  deleteByMediaId(mediaId: string): Promise<number>;
  countByMediaId(mediaId: string): Promise<number>;
}
