import {
  RekognitionClient,
  DetectFacesCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  ListCollectionsCommand,
  DescribeCollectionCommand,
  DeleteFacesCommand,
  SearchFacesCommand,
} from "@aws-sdk/client-rekognition";
import { config } from "@/lib/config/env";
import type { BoundingBox } from "@/lib/types";

export interface RekognitionFaceDetection {
  faceId?: string; // Only available after IndexFaces
  boundingBox: BoundingBox;
  confidence: number;
  imageId?: string;
}

export interface RekognitionIndexResult {
  faceId: string;
  boundingBox: BoundingBox;
  confidence: number;
  imageId: string;
  quality?: {
    brightness: number;
    sharpness: number;
  };
  pose?: {
    roll: number;
    yaw: number;
    pitch: number;
  };
}

export interface RekognitionSearchResult {
  faceId: string;
  similarity: number;
  imageId?: string;
}

export interface FaceMatch {
  sourceFaceId: string;
  matchedFaceId: string;
  similarity: number;
}

// Singleton client instance
let client: RekognitionClient | null = null;

function getClient(): RekognitionClient {
  if (!client) {
    client = new RekognitionClient({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

/**
 * Generate collection ID for a group
 */
export function getCollectionId(groupId: string): string {
  // Collection IDs must match: [a-zA-Z0-9_.\-]+
  const sanitized = groupId.replace(/[^a-zA-Z0-9_.-]/g, "-");
  return `${config.AWS_REKOGNITION_COLLECTION_PREFIX}-${sanitized}`;
}

/**
 * Create a new Rekognition collection for a group
 */
export async function createCollection(groupId: string): Promise<string> {
  const rekognitionClient = getClient();
  const collectionId = getCollectionId(groupId);

  try {
    const command = new CreateCollectionCommand({
      CollectionId: collectionId,
    });

    const response = await rekognitionClient.send(command);
    console.log(
      `Created Rekognition collection: ${collectionId} (ARN: ${response.CollectionArn})`
    );

    return collectionId;
  } catch (error) {
    // Collection might already exist
    if (error instanceof Error && error.name === "ResourceAlreadyExistsException") {
      console.log(`Collection ${collectionId} already exists`);
      return collectionId;
    }
    console.error("Failed to create collection:", error);
    throw error;
  }
}

/**
 * Delete a Rekognition collection
 */
export async function deleteCollection(collectionId: string): Promise<void> {
  const rekognitionClient = getClient();

  try {
    const command = new DeleteCollectionCommand({
      CollectionId: collectionId,
    });

    await rekognitionClient.send(command);
    console.log(`Deleted Rekognition collection: ${collectionId}`);
  } catch (error) {
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      console.log(`Collection ${collectionId} not found, already deleted`);
      return;
    }
    console.error("Failed to delete collection:", error);
    throw error;
  }
}

/**
 * Check if a collection exists
 */
export async function collectionExists(collectionId: string): Promise<boolean> {
  const rekognitionClient = getClient();

  try {
    const command = new DescribeCollectionCommand({
      CollectionId: collectionId,
    });

    await rekognitionClient.send(command);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "ResourceNotFoundException") {
      return false;
    }
    throw error;
  }
}

/**
 * Detect faces in an image (does not index them)
 */
export async function detectFaces(
  s3Bucket: string,
  s3Key: string
): Promise<RekognitionFaceDetection[]> {
  const rekognitionClient = getClient();

  try {
    const command = new DetectFacesCommand({
      Image: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key,
        },
      },
      Attributes: ["ALL"],
    });

    const response = await rekognitionClient.send(command);
    const faces = response.FaceDetails || [];

    return faces.map((face) => ({
      boundingBox: {
        x: face.BoundingBox?.Left || 0,
        y: face.BoundingBox?.Top || 0,
        width: face.BoundingBox?.Width || 0,
        height: face.BoundingBox?.Height || 0,
      },
      confidence: face.Confidence || 0,
    }));
  } catch (error) {
    console.error(`Face detection failed for ${s3Key}:`, error);
    throw error;
  }
}

/**
 * Index faces in an image to a collection (from S3)
 */
export async function indexFaces(
  collectionId: string,
  s3Bucket: string,
  s3Key: string,
  externalImageId?: string
): Promise<RekognitionIndexResult[]>;

/**
 * Index faces in an image to a collection (from bytes)
 */
export async function indexFaces(
  collectionId: string,
  imageBytes: Buffer,
  externalImageId: string
): Promise<RekognitionIndexResult[]>;

/**
 * Index faces in an image to a collection
 */
export async function indexFaces(
  collectionId: string,
  s3BucketOrBytes: string | Buffer,
  s3KeyOrExternalId: string,
  externalImageId?: string
): Promise<RekognitionIndexResult[]> {
  const rekognitionClient = getClient();

  try {
    // Determine if we're using S3 or Bytes
    const isBytes = Buffer.isBuffer(s3BucketOrBytes);

    const command = new IndexFacesCommand({
      CollectionId: collectionId,
      Image: isBytes
        ? {
            Bytes: s3BucketOrBytes, // Use bytes directly
          }
        : {
            S3Object: {
              Bucket: s3BucketOrBytes, // S3 bucket
              Name: s3KeyOrExternalId,  // S3 key
            },
          },
      ExternalImageId: isBytes ? s3KeyOrExternalId : externalImageId,
      DetectionAttributes: ["ALL"],
      MaxFaces: 100,
      QualityFilter: "AUTO",
    });

    const response = await rekognitionClient.send(command);
    const faceRecords = response.FaceRecords || [];

    return faceRecords
      .filter((record) => record.Face && record.FaceDetail)
      .map((record) => {
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
          imageId: record.Face!.ExternalImageId || (isBytes ? s3KeyOrExternalId : externalImageId) || "",
          quality: detail.Quality ? {
            brightness: detail.Quality.Brightness || 0,
            sharpness: detail.Quality.Sharpness || 0,
          } : undefined,
          pose: detail.Pose ? {
            roll: detail.Pose.Roll || 0,
            yaw: detail.Pose.Yaw || 0,
            pitch: detail.Pose.Pitch || 0,
          } : undefined,
        };
      });
  } catch (error) {
    const source = Buffer.isBuffer(s3BucketOrBytes) ? "bytes" : s3KeyOrExternalId;
    console.error(`Face indexing failed for ${source}:`, error);
    throw error;
  }
}

/**
 * Search for similar faces by image
 */
export async function searchFacesByImage(
  collectionId: string,
  s3Bucket: string,
  s3Key: string,
  maxFaces: number = 100,
  faceMatchThreshold: number = 80
): Promise<RekognitionSearchResult[]> {
  const rekognitionClient = getClient();

  try {
    const command = new SearchFacesByImageCommand({
      CollectionId: collectionId,
      Image: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key,
        },
      },
      MaxFaces: maxFaces,
      FaceMatchThreshold: faceMatchThreshold,
    });

    const response = await rekognitionClient.send(command);
    const faceMatches = response.FaceMatches || [];

    return faceMatches
      .filter((match) => match.Face)
      .map((match) => ({
        faceId: match.Face!.FaceId!,
        similarity: match.Similarity || 0,
        imageId: match.Face!.ExternalImageId,
      }));
  } catch (error) {
    // If no faces detected in the search image, return empty array
    if (error instanceof Error && error.name === "InvalidParameterException") {
      console.log(`No faces found in search image: ${s3Key}`);
      return [];
    }
    console.error(`Face search failed for ${s3Key}:`, error);
    throw error;
  }
}

/**
 * Search for similar faces by face ID
 */
export async function searchFaces(
  collectionId: string,
  faceId: string,
  maxFaces: number = 100,
  faceMatchThreshold: number = 80
): Promise<RekognitionSearchResult[]> {
  const rekognitionClient = getClient();

  try {
    const command = new SearchFacesCommand({
      CollectionId: collectionId,
      FaceId: faceId,
      MaxFaces: maxFaces,
      FaceMatchThreshold: faceMatchThreshold,
    });

    const response = await rekognitionClient.send(command);
    const faceMatches = response.FaceMatches || [];

    return faceMatches
      .filter((match) => match.Face)
      .map((match) => ({
        faceId: match.Face!.FaceId!,
        similarity: match.Similarity || 0,
        imageId: match.Face!.ExternalImageId,
      }));
  } catch (error) {
    console.error(`Face search failed for faceId ${faceId}:`, error);
    throw error;
  }
}

/**
 * Delete faces from a collection
 */
export async function deleteFaces(
  collectionId: string,
  faceIds: string[]
): Promise<void> {
  if (faceIds.length === 0) return;

  const rekognitionClient = getClient();

  try {
    const command = new DeleteFacesCommand({
      CollectionId: collectionId,
      FaceIds: faceIds,
    });

    await rekognitionClient.send(command);
    console.log(`Deleted ${faceIds.length} faces from ${collectionId}`);
  } catch (error) {
    console.error("Failed to delete faces:", error);
    throw error;
  }
}

/**
 * List all collections
 */
export async function listCollections(): Promise<string[]> {
  const rekognitionClient = getClient();

  try {
    const command = new ListCollectionsCommand({});
    const response = await rekognitionClient.send(command);

    return response.CollectionIds || [];
  } catch (error) {
    console.error("Failed to list collections:", error);
    throw error;
  }
}

/**
 * Calculate overall quality score for a face
 * Higher score = better quality face for display
 *
 * Factors:
 * - Confidence: How sure it's a face
 * - Brightness: Well-lit (not too dark/bright)
 * - Sharpness: Clear and not blurry
 * - Pose: Facing camera (low angles)
 */
export function calculateFaceQualityScore(face: RekognitionIndexResult): number {
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

    // Penalize based on angle deviations
    // Perfect frontal face: all angles near 0
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

/**
 * Get collection details
 */
export async function getCollectionDetails(collectionId: string): Promise<{
  faceCount: number;
  createdTimestamp: Date;
} | null> {
  const rekognitionClient = getClient();

  try {
    const command = new DescribeCollectionCommand({
      CollectionId: collectionId,
    });

    const response = await rekognitionClient.send(command);

    return {
      faceCount: response.FaceCount || 0,
      createdTimestamp: response.CreationTimestamp || new Date(),
    };
  } catch (error) {
    console.error(`Failed to get collection details for ${collectionId}:`, error);
    return null;
  }
}
