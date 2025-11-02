import {
  RekognitionClient,
  DetectFacesCommand,
  IndexFacesCommand,
  SearchFacesCommand,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  DescribeCollectionCommand,
  DeleteFacesCommand,
} from '@aws-sdk/client-rekognition';
import { IFaceRecognitionService } from '../../core/interfaces/services/IFaceRecognitionService.js';
import { RekognitionFaceData, FaceSimilarity } from '../../shared/types/index.js';
import { env } from '../../config/env.js';

export class RekognitionService implements IFaceRecognitionService {
  private client: RekognitionClient;
  private collectionPrefix: string;

  constructor() {
    this.client = new RekognitionClient({
      region: env.get('AWS_REGION'),
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.collectionPrefix = env.get('AWS_REKOGNITION_COLLECTION_PREFIX');
  }

  private getCollectionId(groupId: string): string {
    // Collection IDs must match: [a-zA-Z0-9_.\-]+
    const sanitized = groupId.replace(/[^a-zA-Z0-9_.-]/g, '-');
    return `${this.collectionPrefix}-${sanitized}`;
  }

  async createCollection(groupId: string): Promise<string> {
    const collectionId = this.getCollectionId(groupId);

    try {
      const command = new CreateCollectionCommand({
        CollectionId: collectionId,
      });

      const response = await this.client.send(command);
      console.log(
        `Created Rekognition collection: ${collectionId} (ARN: ${response.CollectionArn})`
      );

      return collectionId;
    } catch (error: any) {
      // Collection might already exist
      if (error.name === 'ResourceAlreadyExistsException') {
        console.log(`Collection ${collectionId} already exists`);
        return collectionId;
      }
      console.error('Failed to create collection:', error);
      throw error;
    }
  }

  async collectionExists(collectionId: string): Promise<boolean> {
    try {
      const command = new DescribeCollectionCommand({
        CollectionId: collectionId,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return false;
      }
      throw error;
    }
  }

  async deleteCollection(collectionId: string): Promise<void> {
    try {
      const command = new DeleteCollectionCommand({
        CollectionId: collectionId,
      });

      await this.client.send(command);
      console.log(`Deleted Rekognition collection: ${collectionId}`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`Collection ${collectionId} not found, already deleted`);
        return;
      }
      console.error('Failed to delete collection:', error);
      throw error;
    }
  }

  async detectFaces(s3Bucket: string, s3Key: string): Promise<RekognitionFaceData[]> {
    try {
      const command = new DetectFacesCommand({
        Image: {
          S3Object: {
            Bucket: s3Bucket,
            Name: s3Key,
          },
        },
        Attributes: ['ALL'],
      });

      const response = await this.client.send(command);
      const faces = response.FaceDetails || [];

      return faces.map(face => ({
        faceId: '', // Not available in DetectFaces
        boundingBox: {
          x: face.BoundingBox?.Left || 0,
          y: face.BoundingBox?.Top || 0,
          width: face.BoundingBox?.Width || 0,
          height: face.BoundingBox?.Height || 0,
        },
        confidence: face.Confidence || 0,
        quality: face.Quality
          ? {
              brightness: face.Quality.Brightness || 0,
              sharpness: face.Quality.Sharpness || 0,
            }
          : undefined,
        pose: face.Pose
          ? {
              roll: face.Pose.Roll || 0,
              yaw: face.Pose.Yaw || 0,
              pitch: face.Pose.Pitch || 0,
            }
          : undefined,
      }));
    } catch (error) {
      console.error(`Face detection failed for ${s3Key}:`, error);
      throw error;
    }
  }

  async indexFaces(
    collectionId: string,
    s3BucketOrBuffer: string | Buffer,
    s3KeyOrExternalId: string,
    externalImageId?: string
  ): Promise<RekognitionFaceData[]> {
    try {
      // Determine if we're using S3 or Bytes
      const isBytes = Buffer.isBuffer(s3BucketOrBuffer);

      const command = new IndexFacesCommand({
        CollectionId: collectionId,
        Image: isBytes
          ? {
              Bytes: s3BucketOrBuffer, // Use bytes directly
            }
          : {
              S3Object: {
                Bucket: s3BucketOrBuffer, // S3 bucket
                Name: s3KeyOrExternalId, // S3 key
              },
            },
        ExternalImageId: isBytes ? s3KeyOrExternalId : externalImageId,
        DetectionAttributes: ['ALL'],
        MaxFaces: 100,
        QualityFilter: 'AUTO',
      });

      const response = await this.client.send(command);
      const faceRecords = response.FaceRecords || [];

      return faceRecords
        .filter(record => record.Face && record.FaceDetail)
        .map(record => {
          const detail = record.FaceDetail!;
          return {
            faceId: record.Face!.FaceId!,
            boundingBox: {
              x: detail.BoundingBox?.Left || 0,
              y: detail.BoundingBox?.Top || 0,
              width: detail.BoundingBox?.Width || 0,
              height: detail.BoundingBox?.Height || 0,
            },
            confidence: detail.Confidence || 0,
            quality: detail.Quality
              ? {
                  brightness: detail.Quality.Brightness || 0,
                  sharpness: detail.Quality.Sharpness || 0,
                }
              : undefined,
            pose: detail.Pose
              ? {
                  roll: detail.Pose.Roll || 0,
                  yaw: detail.Pose.Yaw || 0,
                  pitch: detail.Pose.Pitch || 0,
                }
              : undefined,
          };
        });
    } catch (error) {
      const source = Buffer.isBuffer(s3BucketOrBuffer) ? 'bytes' : s3KeyOrExternalId;
      console.error(`Face indexing failed for ${source}:`, error);
      throw error;
    }
  }

  async searchFaces(
    collectionId: string,
    faceId: string,
    maxFaces: number = 100,
    threshold: number = 80
  ): Promise<FaceSimilarity[]> {
    try {
      const command = new SearchFacesCommand({
        CollectionId: collectionId,
        FaceId: faceId,
        MaxFaces: maxFaces,
        FaceMatchThreshold: threshold,
      });

      const response = await this.client.send(command);
      const faceMatches = response.FaceMatches || [];

      return faceMatches
        .filter(match => match.Face)
        .map(match => ({
          faceId: match.Face!.FaceId!,
          similarity: match.Similarity || 0,
        }));
    } catch (error) {
      console.error(`Face search failed for faceId ${faceId}:`, error);
      throw error;
    }
  }

  async deleteFaces(collectionId: string, faceIds: string[]): Promise<void> {
    if (faceIds.length === 0) return;

    try {
      const command = new DeleteFacesCommand({
        CollectionId: collectionId,
        FaceIds: faceIds,
      });

      await this.client.send(command);
      console.log(`Deleted ${faceIds.length} faces from ${collectionId}`);
    } catch (error) {
      console.error('Failed to delete faces:', error);
      throw error;
    }
  }

  /**
   * Calculate overall quality score for a face
   * Higher score = better quality face for display
   */
  calculateFaceQualityScore(face: RekognitionFaceData): number {
    let score = 0;

    // Confidence (0-30 points)
    score += (face.confidence / 100) * 30;

    // Brightness (0-25 points) - prefer 40-80 range (optimal lighting)
    if (face.quality?.brightness) {
      const brightness = face.quality.brightness;
      if (brightness >= 40 && brightness <= 80) {
        score += 25; // Optimal
      } else if (brightness >= 30 && brightness <= 90) {
        score += 15; // Acceptable
      } else {
        score += 5; // Too dark or too bright
      }
    }

    // Sharpness (0-25 points)
    if (face.quality?.sharpness) {
      score += (face.quality.sharpness / 100) * 25;
    }

    // Pose (0-20 points) - prefer face looking at camera
    if (face.pose) {
      const { roll, yaw, pitch } = face.pose;

      // Calculate deviation from straight-on (0 degrees)
      const rollDeviation = Math.abs(roll);
      const yawDeviation = Math.abs(yaw);
      const pitchDeviation = Math.abs(pitch);

      // Average deviation
      const avgDeviation = (rollDeviation + yawDeviation + pitchDeviation) / 3;

      if (avgDeviation < 10) {
        score += 20; // Nearly perfect frontal
      } else if (avgDeviation < 20) {
        score += 15; // Good frontal
      } else if (avgDeviation < 30) {
        score += 10; // Acceptable
      } else {
        score += 5; // Profile or angled
      }
    }

    return Math.min(100, Math.round(score));
  }
}
