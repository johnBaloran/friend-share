import { Worker, Job } from 'bullmq';
import { container } from '../di/container.js';
import { QUEUE_NAMES } from '../shared/constants/index.js';
import {
  FaceDetectionJobData,
  FaceGroupingJobData,
  CleanupJobData,
} from '../shared/types/index.js';
import type { IGroupRepository } from '../core/interfaces/repositories/IGroupRepository.js';
import type { IMediaRepository } from '../core/interfaces/repositories/IMediaRepository.js';
import type { IFaceDetectionRepository } from '../core/interfaces/repositories/IFaceDetectionRepository.js';
import type { IFaceClusterRepository, IFaceClusterMemberRepository } from '../core/interfaces/repositories/IFaceClusterRepository.js';
import type { IFaceRecognitionService } from '../core/interfaces/services/IFaceRecognitionService.js';
import type { IFaceEnhancementService } from '../core/interfaces/services/IFaceEnhancementService.js';
import type { IStorageService } from '../core/interfaces/services/IStorageService.js';
import type { FaceClusteringService } from '../infrastructure/aws/FaceClusteringService.js';
import type { IQueueService } from '../core/interfaces/services/IQueueService.js';
import { FaceDetection } from '../core/entities/FaceDetection.js';
import { FaceCluster, FaceClusterMember } from '../core/entities/FaceCluster.js';
import { RekognitionService } from '../infrastructure/aws/RekognitionService.js';
import { RedisCacheService, CacheKeys } from '../infrastructure/cache/RedisCacheService.js';
import { env } from '../config/env.js';
import Redis from 'ioredis';

// Redis connection for workers
const redisConnection = new Redis(env.get('REDIS_URL'), {
  maxRetriesPerRequest: null,
});

// Get services from DI container
const groupRepository = container.get<IGroupRepository>('GroupRepository');
const mediaRepository = container.get<IMediaRepository>('MediaRepository');
const faceDetectionRepository = container.get<IFaceDetectionRepository>('FaceDetectionRepository');
const faceClusterRepository = container.get<IFaceClusterRepository>('FaceClusterRepository');
const faceClusterMemberRepository = container.get<IFaceClusterMemberRepository>('FaceClusterMemberRepository');
const rekognitionService = container.get<IFaceRecognitionService>('RekognitionService');
const faceEnhancementService = container.get<IFaceEnhancementService>('FaceEnhancementService');
const faceClusteringService = container.get<FaceClusteringService>('FaceClusteringService');
const queueService = container.get<IQueueService>('QueueService');
const s3Service = container.get<IStorageService>('S3Service');
const cacheService = container.get<RedisCacheService>('CacheService');

/**
 * Face Detection Worker
 * Processes uploaded images to detect and index faces using AWS Rekognition
 */
export const faceDetectionWorker = new Worker<FaceDetectionJobData>(
  QUEUE_NAMES.FACE_DETECTION,
  async (job: Job<FaceDetectionJobData>): Promise<void> => {
    const { mediaIds, groupId, userId } = job.data;
    const jobId = job.id!;

    console.log(
      `[Face Detection] Starting job ${jobId} for ${mediaIds.length} media items`
    );

    try {
      await job.updateProgress(0);

      // Get group and ensure collection exists
      const group = await groupRepository.findById(groupId);
      if (!group) {
        throw new Error(`Group ${groupId} not found`);
      }

      let collectionId = group.rekognitionCollectionId;
      if (!collectionId) {
        console.log(`Creating Rekognition collection for group ${groupId}`);
        collectionId = await rekognitionService.createCollection(groupId);
        const updatedGroup = group.setRekognitionCollection(collectionId);
        await groupRepository.update(groupId, updatedGroup);
      }

      // Get media items
      const mediaItems = await mediaRepository.findByIds(mediaIds);
      if (mediaItems.length === 0) {
        throw new Error('No valid media items found');
      }

      await job.updateProgress(10);

      let processedCount = 0;
      const totalCount = mediaItems.length;
      const allFaceDetectionIds: string[] = [];

      // Process each media item
      for (const media of mediaItems) {
        try {
          console.log(
            `[Face Detection] Processing media ${media.id} (${processedCount + 1}/${totalCount})`
          );

          // Stage 1: Detect faces to get bounding boxes
          const detectedFaces = await rekognitionService.detectFaces(
            media.s3Bucket,
            media.s3Key
          );

          if (detectedFaces.length === 0) {
            console.log(`[Face Detection] No faces detected in ${media.id}`);
            await mediaRepository.update(media.id, { processed: true });
            processedCount++;
            continue;
          }

          console.log(`[Face Detection] Detected ${detectedFaces.length} faces`);

          // Stage 2: Download image buffer and enhance each detected face
          const imageBuffer = await s3Service.getObjectBuffer(media.s3Key);
          const enhancedFaces = await faceEnhancementService.enhanceMultipleFaces(
            imageBuffer,
            detectedFaces.map(f => f.boundingBox)
          );

          console.log(`[Face Detection] Enhanced ${enhancedFaces.length} faces`);

          // Stage 3: Index enhanced faces in Rekognition and upload thumbnails
          for (let i = 0; i < enhancedFaces.length; i++) {
            const enhancedFace = enhancedFaces[i];
            const originalFace = detectedFaces[i];

            try {
              // Upload face thumbnail to S3
              const thumbnailKey = `thumbnails/${groupId}/${media.id}-face-${i}-${Date.now()}.jpg`;
              await s3Service.uploadBuffer(enhancedFace.buffer, thumbnailKey, 'image/jpeg');
              console.log(`[Face Detection] Uploaded thumbnail: ${thumbnailKey}`);

              const indexedFaces = await rekognitionService.indexFaces(
                collectionId,
                enhancedFace.buffer,
                `${media.id}-face-${i}`
              );

              if (indexedFaces.length > 0) {
                const indexedFace = indexedFaces[0];
                // Calculate quality score using RekognitionService directly
                const qualityScore = (rekognitionService as RekognitionService).calculateFaceQualityScore(indexedFace);

                const faceDetectionEntity = FaceDetection.create({
                  mediaId: media.id,
                  rekognitionFaceId: indexedFace.faceId,
                  boundingBox: originalFace.boundingBox,
                  confidence: indexedFace.confidence,
                  quality: indexedFace.quality,
                  pose: indexedFace.pose,
                  qualityScore: qualityScore,
                  thumbnailS3Key: thumbnailKey,
                });

                const faceDetection = await faceDetectionRepository.create(faceDetectionEntity);
                allFaceDetectionIds.push(faceDetection.id);
              }
            } catch (error) {
              console.error(`[Face Detection] Failed to index face ${i}:`, error);
            }
          }

          // Mark media as processed
          await mediaRepository.update(media.id, { processed: true });

          processedCount++;
          const progress = Math.round(10 + (processedCount / totalCount) * 80);
          await job.updateProgress(progress);

          console.log(
            `[Face Detection] ✅ Completed ${media.id}: ${allFaceDetectionIds.length} total faces indexed`
          );

          // Rate limiting
          if (processedCount < totalCount) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        } catch (error) {
          console.error(`[Face Detection] Failed to process media ${media.id}:`, error);
        }
      }

      // Queue face grouping job if we have faces
      if (allFaceDetectionIds.length > 0) {
        await job.updateProgress(95);

        console.log(
          `[Face Detection] Queueing face grouping for ${allFaceDetectionIds.length} faces`
        );

        await queueService.addJob(
          QUEUE_NAMES.FACE_GROUPING,
          'FACE_GROUPING',
          {
            groupId,
            userId,
            faceDetectionIds: allFaceDetectionIds,
            metadata: {
              triggeredByJob: jobId,
            },
          }
        );
      }

      // Invalidate media cache so frontend sees updated processing status
      await cacheService.deletePattern(`media:group:${groupId}:page:*`);
      console.log(`[Face Detection] Invalidated media cache for group ${groupId}`);

      await job.updateProgress(100);
      console.log(
        `[Face Detection] Job ${jobId} completed. Detected ${allFaceDetectionIds.length} faces.`
      );
    } catch (error) {
      console.error(`[Face Detection] Job ${jobId} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 },
  }
);

/**
 * Face Grouping Worker
 * Clusters detected faces into groups representing individual people
 */
export const faceGroupingWorker = new Worker<FaceGroupingJobData>(
  QUEUE_NAMES.FACE_GROUPING,
  async (job: Job<FaceGroupingJobData>): Promise<void> => {
    const { faceDetectionIds, groupId } = job.data;
    const jobId = job.id!;

    console.log(
      `[Face Grouping] Starting job ${jobId} for ${faceDetectionIds.length} face detections`
    );

    try {
      await job.updateProgress(0);

      // Get group and collection ID
      const group = await groupRepository.findById(groupId);
      if (!group || !group.rekognitionCollectionId) {
        throw new Error(`Group ${groupId} not found or missing collection ID`);
      }

      const collectionId = group.rekognitionCollectionId;

      // Get unprocessed face detections
      const faceDetections = await faceDetectionRepository.findByIds(faceDetectionIds);
      const unprocessedFaces = faceDetections.filter((face) => !face.processed);

      if (unprocessedFaces.length === 0) {
        console.log('[Face Grouping] No unprocessed faces found');
        await job.updateProgress(100);
        return;
      }

      const rekognitionFaceIds = unprocessedFaces.map((f) => f.rekognitionFaceId);
      const faceIdToDetectionId = new Map<string, string>();

      unprocessedFaces.forEach((f) => {
        faceIdToDetectionId.set(f.rekognitionFaceId, f.id);
      });

      await job.updateProgress(20);

      // Use clustering algorithm
      console.log(
        `[Face Grouping] Clustering ${rekognitionFaceIds.length} faces...`
      );

      const clusteringResult = await faceClusteringService.clusterFaces(
        collectionId,
        rekognitionFaceIds,
        85 // Similarity threshold
      );

      await job.updateProgress(60);

      let clustersCreated = 0;
      let facesGrouped = 0;

      // Create clusters for grouped faces (only clusters with 2+ faces)
      for (const cluster of clusteringResult.clusters) {
        const faceClusterEntity = FaceCluster.create({
          groupId,
          appearanceCount: cluster.size,
          confidence: cluster.averageSimilarity / 100,
          clusterName: undefined,
        });

        const faceCluster = await faceClusterRepository.create(faceClusterEntity);

        // Add faces to cluster
        const detectionIds = cluster.faceIds
          .map((rekognitionFaceId) => faceIdToDetectionId.get(rekognitionFaceId))
          .filter((id): id is string => Boolean(id));

        await Promise.all(
          detectionIds.map((detectionId) => {
            const memberEntity = FaceClusterMember.create({
              clusterId: faceCluster.id,
              faceDetectionId: detectionId,
              confidence: cluster.averageSimilarity / 100,
            });
            return faceClusterMemberRepository.create(memberEntity);
          })
        );

        clustersCreated++;
        facesGrouped += cluster.size;
      }

      // Note: Unclustered faces (single appearances) are intentionally not stored
      // to reduce noise in face grouping. Only faces appearing in 2+ photos are clustered.
      console.log(
        `[Face Grouping] Skipped ${clusteringResult.unclusteredFaces.length} single-appearance faces (noise reduction)`
      );

      // Mark face detections as processed
      await Promise.all(
        faceDetectionIds.map((id) =>
          faceDetectionRepository.update(id, { processed: true })
        )
      );

      // Invalidate caches so frontend sees new clusters and updated media status
      await cacheService.delete(CacheKeys.clustersByGroup(groupId));
      await cacheService.deletePattern(`media:group:${groupId}:page:*`);
      console.log(`[Face Grouping] Invalidated cluster and media cache for group ${groupId}`);

      await job.updateProgress(100);

      console.log(
        `[Face Grouping] Job ${jobId} completed. Created ${clustersCreated} clusters for ${facesGrouped} faces.`
      );
    } catch (error) {
      console.error(`[Face Grouping] Job ${jobId} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 },
  }
);

/**
 * Cleanup Worker
 * Deletes media files and associated data from S3 and database
 */
export const cleanupWorker = new Worker<CleanupJobData>(
  QUEUE_NAMES.CLEANUP,
  async (job: Job<CleanupJobData>): Promise<void> => {
    const { groupId, targetDate, mediaIds } = job.data;
    const jobId = job.id!;

    console.log(`[Cleanup] Starting job ${jobId} for group ${groupId}`);

    try {
      await job.updateProgress(0);

      let mediaToDelete;

      if (mediaIds && mediaIds.length > 0) {
        // Delete specific media items
        mediaToDelete = await mediaRepository.findByIds(mediaIds);
      } else if (targetDate) {
        // Delete media older than target date
        const allMedia = await mediaRepository.findByGroupId(groupId, {
          page: 1,
          limit: 10000,
        });
        mediaToDelete = allMedia.data.filter(
          (m) => m.createdAt < targetDate
        );
      } else {
        throw new Error('Either mediaIds or targetDate must be provided');
      }

      if (mediaToDelete.length === 0) {
        console.log('[Cleanup] No media found to delete');
        await job.updateProgress(100);
        return;
      }

      await job.updateProgress(20);

      // Delete from S3
      const s3Keys = mediaToDelete.map((m) => m.s3Key);
      await s3Service.deleteFiles(s3Keys);

      await job.updateProgress(70);

      // Delete from database
      const mediaIdsToDelete = mediaToDelete.map((m) => m.id);

      // Delete associated face detections
      for (const mediaId of mediaIdsToDelete) {
        const faceDetections = await faceDetectionRepository.findByMediaId(mediaId);
        for (const detection of faceDetections) {
          await faceDetectionRepository.delete(detection.id);
        }
      }

      // Delete media
      for (const mediaId of mediaIdsToDelete) {
        await mediaRepository.delete(mediaId);
      }

      // Update group storage usage
      const totalSize = mediaToDelete.reduce((sum, m) => sum + m.fileSize, 0);
      await groupRepository.updateStorageUsed(groupId, -totalSize);

      await job.updateProgress(100);

      console.log(
        `[Cleanup] Job ${jobId} completed. Deleted ${mediaToDelete.length} media items (${totalSize} bytes freed).`
      );
    } catch (error) {
      console.error(`[Cleanup] Job ${jobId} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
    removeOnComplete: { count: 5 },
    removeOnFail: { count: 3 },
  }
);

// Export workers array for easy management
export const workers = [faceDetectionWorker, faceGroupingWorker, cleanupWorker];
