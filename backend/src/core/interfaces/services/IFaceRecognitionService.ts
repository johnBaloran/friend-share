import { RekognitionFaceData, FaceSimilarity } from '../../../shared/types/index.js';

export interface IFaceRecognitionService {
  createCollection(groupId: string): Promise<string>;

  collectionExists(collectionId: string): Promise<boolean>;

  deleteCollection(collectionId: string): Promise<void>;

  detectFaces(s3Bucket: string, s3Key: string): Promise<RekognitionFaceData[]>;

  indexFaces(
    collectionId: string,
    s3BucketOrBuffer: string | Buffer,
    s3KeyOrExternalId: string,
    externalImageId?: string
  ): Promise<RekognitionFaceData[]>;

  searchFaces(
    collectionId: string,
    faceId: string,
    maxFaces?: number,
    threshold?: number
  ): Promise<FaceSimilarity[]>;

  deleteFaces(collectionId: string, faceIds: string[]): Promise<void>;
}
