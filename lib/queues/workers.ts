import { Worker } from "bullmq";
import { Media } from "@/lib/models/Media";
import { FaceDetection } from "@/lib/models/FaceDetection";
import { FaceCluster } from "@/lib/models/FaceCluster";
import { FaceClusterMember } from "@/lib/models/FaceClusterMember";
import { JobStatus } from "@/lib/models/JobStatus";
import { Group } from "@/lib/models/Group";
import { createCollection, indexFaces, calculateFaceQualityScore } from "@/lib/services/rekognition";
import { bulkDelete } from "@/lib/services/s3";
import { clusterFaces } from "@/lib/services/faceClustering";
import connectDB from "@/lib/config/database";
import redis from "@/lib/services/redis";
import { faceGroupingQueue } from "./index";
import { config } from "@/lib/config/env";
import type {
  FaceDetectionJobData,
  FaceGroupingJobData,
  CleanupJobData,
  JobType,
  JobStatus as JobStatusType,
} from "@/lib/types";

// Helper function to update job status
async function updateJobStatus(
  jobId: string,
  jobType: JobType,
  status: JobStatusType,
  progress: number,
  errorMessage?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await connectDB();
    await JobStatus.findOneAndUpdate(
      { jobId },
      {
        jobId,
        jobType,
        status,
        progress,
        errorMessage,
        metadata: metadata || {},
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Failed to update job status:", error);
  }
}

// Face Detection Worker - Updated for AWS Rekognition
export const faceDetectionWorker = new Worker<FaceDetectionJobData>(
  "face-detection",
  async (job): Promise<void> => {
    const { mediaIds, groupId } = job.data;
    const jobId = job.id!;

    console.log(
      `Starting face detection job ${jobId} for ${mediaIds.length} media items`
    );

    await updateJobStatus(jobId, "FACE_DETECTION", "PROCESSING", 0);

    try {
      await connectDB();

      // Get group to retrieve collection ID
      const group = await Group.findById(groupId);
      if (!group) {
        throw new Error(`Group ${groupId} not found`);
      }

      // Ensure collection exists
      let collectionId = group.rekognitionCollectionId;
      if (!collectionId) {
        // Create collection if it doesn't exist
        collectionId = await createCollection(groupId);
        await Group.findByIdAndUpdate(groupId, {
          rekognitionCollectionId: collectionId,
        });
      }

      // Get media items from database
      const mediaItems = await Media.find({
        _id: { $in: mediaIds },
        groupId,
      }).select("_id s3Key s3Bucket filename");

      if (mediaItems.length === 0) {
        throw new Error("No valid media items found");
      }

      await updateJobStatus(
        jobId,
        "FACE_DETECTION",
        "PROCESSING",
        10,
        undefined,
        {
          totalItems: mediaItems.length,
          currentStep: "indexing_faces",
        }
      );

      let processedCount = 0;
      const totalCount = mediaItems.length;
      const allFaceDetectionIds: string[] = [];

      // Process each media item: Index faces in Rekognition
      for (const mediaItem of mediaItems) {
        try {
          console.log(
            `Indexing faces for media ${mediaItem._id} (${
              processedCount + 1
            }/${totalCount})`
          );

          // Index faces in Rekognition (detects and stores in collection)
          const indexedFaces = await indexFaces(
            collectionId,
            mediaItem.s3Bucket,
            mediaItem.s3Key,
            mediaItem._id.toString() // Use media ID as external image ID
          );

          // Store face detections in database with quality metrics
          for (const face of indexedFaces) {
            const qualityScore = calculateFaceQualityScore(face);

            const faceDetection = await FaceDetection.create({
              mediaId: mediaItem._id,
              rekognitionFaceId: face.faceId,
              boundingBox: face.boundingBox,
              confidence: face.confidence,
              quality: face.quality,
              pose: face.pose,
              qualityScore: qualityScore,
            });
            allFaceDetectionIds.push(faceDetection._id.toString());
          }

          // Mark media as processed
          await Media.findByIdAndUpdate(mediaItem._id, { processed: true });

          console.log(
            `Indexed ${indexedFaces.length} faces for media ${mediaItem._id}`
          );

          processedCount++;
          const progress = Math.round(10 + (processedCount / totalCount) * 80); // 10-90%

          await updateJobStatus(
            jobId,
            "FACE_DETECTION",
            "PROCESSING",
            progress,
            undefined,
            {
              totalItems: totalCount,
              processedItems: processedCount,
              facesDetected: allFaceDetectionIds.length,
            }
          );

          // Rate limiting: wait 1 second between images
          if (processedCount < totalCount) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(
            `Failed to index faces for media ${mediaItem._id}:`,
            error
          );
          // Continue with next media item
        }
      }

      // Queue face grouping job if we have faces
      if (allFaceDetectionIds.length > 0) {
        await updateJobStatus(
          jobId,
          "FACE_DETECTION",
          "PROCESSING",
          95,
          undefined,
          {
            totalItems: totalCount,
            processedItems: processedCount,
            facesDetected: allFaceDetectionIds.length,
            currentStep: "queuing_grouping",
          }
        );

        await faceGroupingQueue.add("group-faces", {
          groupId,
          userId: job.data.userId,
          faceDetectionIds: allFaceDetectionIds,
          metadata: {
            triggeredByJob: jobId,
          },
        });
      }

      await updateJobStatus(
        jobId,
        "FACE_DETECTION",
        "COMPLETED",
        100,
        undefined,
        {
          totalItems: totalCount,
          processedItems: processedCount,
          facesDetected: allFaceDetectionIds.length,
          completedAt: new Date().toISOString(),
        }
      );

      console.log(
        `Face detection job ${jobId} completed. Detected ${allFaceDetectionIds.length} faces.`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Face detection job ${jobId} failed:`, error);
      await updateJobStatus(jobId, "FACE_DETECTION", "FAILED", 0, errorMessage);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 },
  }
);

// Face Grouping Worker - Updated for custom clustering algorithm
export const faceGroupingWorker = new Worker<FaceGroupingJobData>(
  "face-grouping",
  async (job): Promise<void> => {
    const { faceDetectionIds, groupId } = job.data;
    const jobId = job.id!;

    console.log(
      `Starting face grouping job ${jobId} for ${faceDetectionIds.length} face detections`
    );

    await updateJobStatus(jobId, "FACE_GROUPING", "PROCESSING", 0);

    try {
      await connectDB();

      // Get group and collection ID
      const group = await Group.findById(groupId);
      if (!group || !group.rekognitionCollectionId) {
        throw new Error(`Group ${groupId} not found or missing collection ID`);
      }

      const collectionId = group.rekognitionCollectionId;

      // Get unprocessed face detections
      const faceDetections = await FaceDetection.find({
        _id: { $in: faceDetectionIds },
        processed: false,
      }).select("_id rekognitionFaceId");

      if (faceDetections.length === 0) {
        await updateJobStatus(
          jobId,
          "FACE_GROUPING",
          "COMPLETED",
          100,
          undefined,
          {
            message: "No valid face detections found",
          }
        );
        return;
      }

      const rekognitionFaceIds = faceDetections.map((f) => f.rekognitionFaceId);
      const faceIdToDetectionId = new Map<string, string>();

      faceDetections.forEach((f) => {
        faceIdToDetectionId.set(f.rekognitionFaceId, f._id.toString());
      });

      await updateJobStatus(
        jobId,
        "FACE_GROUPING",
        "PROCESSING",
        20,
        undefined,
        {
          totalFaces: rekognitionFaceIds.length,
          currentStep: "clustering_faces",
        }
      );

      // Use custom clustering algorithm with aggressive threshold
      const clusteringResult = await clusterFaces(
        collectionId,
        rekognitionFaceIds,
        85 // 75% similarity threshold (lowered from 85->80->75 for better grouping)
      );

      await updateJobStatus(
        jobId,
        "FACE_GROUPING",
        "PROCESSING",
        60,
        undefined,
        {
          totalFaces: rekognitionFaceIds.length,
          clustersFound: clusteringResult.clusters.length,
          currentStep: "creating_clusters",
        }
      );

      let clustersCreated = 0;
      let facesGrouped = 0;

      // Create clusters for grouped faces (size > 1)
      for (const cluster of clusteringResult.clusters) {
        // Create FaceCluster
        const faceCluster = await FaceCluster.create({
          groupId,
          appearanceCount: cluster.size,
          confidence: cluster.averageSimilarity / 100, // Convert percentage to 0-1
        });

        // Add faces to cluster
        const clusterMemberPromises = cluster.faceIds
          .map((rekognitionFaceId) =>
            faceIdToDetectionId.get(rekognitionFaceId)
          )
          .filter((detectionId): detectionId is string => Boolean(detectionId))
          .map((detectionId) =>
            FaceClusterMember.create({
              clusterId: faceCluster._id,
              faceDetectionId: detectionId,
              confidence: cluster.averageSimilarity / 100,
            })
          );

        await Promise.all(clusterMemberPromises);
        clustersCreated++;
        facesGrouped += cluster.size;
      }

      // Create individual clusters for unclustered faces (messyGroup equivalent)
      for (const rekognitionFaceId of clusteringResult.unclusteredFaces) {
        const detectionId = faceIdToDetectionId.get(rekognitionFaceId);
        if (!detectionId) continue;

        const faceCluster = await FaceCluster.create({
          groupId,
          appearanceCount: 1,
          confidence: 0.5, // Lower confidence for single faces
        });

        await FaceClusterMember.create({
          clusterId: faceCluster._id,
          faceDetectionId: detectionId,
          confidence: 0.5,
        });

        clustersCreated++;
        facesGrouped++;
      }

      // Mark face detections as processed
      await FaceDetection.updateMany(
        { _id: { $in: faceDetectionIds } },
        { processed: true }
      );

      await updateJobStatus(
        jobId,
        "FACE_GROUPING",
        "COMPLETED",
        100,
        undefined,
        {
          totalFaces: rekognitionFaceIds.length,
          clustersCreated,
          facesGrouped,
          unclusteredFaces: clusteringResult.unclusteredFaces.length,
          completedAt: new Date().toISOString(),
        }
      );

      console.log(
        `Face grouping job ${jobId} completed. Created ${clustersCreated} clusters for ${facesGrouped} faces.`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Face grouping job ${jobId} failed:`, error);
      await updateJobStatus(jobId, "FACE_GROUPING", "FAILED", 0, errorMessage);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1, // Single concurrency to avoid conflicts
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 },
  }
);

// Cleanup Worker - Updated for S3
export const cleanupWorker = new Worker<CleanupJobData>(
  "cleanup",
  async (job): Promise<void> => {
    const { groupId, targetDate, mediaIds } = job.data;
    const jobId = job.id!;

    console.log(`Starting cleanup job ${jobId} for group ${groupId}`);

    await updateJobStatus(jobId, "MEDIA_CLEANUP", "PROCESSING", 0);

    try {
      await connectDB();

      let mediaToDelete;

      if (mediaIds) {
        // Delete specific media items
        mediaToDelete = await Media.find({
          _id: { $in: mediaIds },
          groupId,
        }).select("_id s3Key fileSize");
      } else {
        // Delete all media older than target date
        mediaToDelete = await Media.find({
          groupId,
          createdAt: { $lt: targetDate },
        }).select("_id s3Key fileSize");
      }

      if (mediaToDelete.length === 0) {
        await updateJobStatus(
          jobId,
          "MEDIA_CLEANUP",
          "COMPLETED",
          100,
          undefined,
          {
            message: "No media found to delete",
          }
        );
        return;
      }

      await updateJobStatus(
        jobId,
        "MEDIA_CLEANUP",
        "PROCESSING",
        20,
        undefined,
        {
          totalItems: mediaToDelete.length,
          currentStep: "deleting_from_s3",
        }
      );

      // Delete from S3
      const s3Keys = mediaToDelete.map((m) => m.s3Key);
      await bulkDelete(s3Keys);

      await updateJobStatus(
        jobId,
        "MEDIA_CLEANUP",
        "PROCESSING",
        70,
        undefined,
        {
          totalItems: mediaToDelete.length,
          currentStep: "deleting_from_database",
        }
      );

      // Delete from database (cascades to face detections and cluster members)
      const mediaIdsToDelete = mediaToDelete.map((m) => m._id);

      // Delete associated face detections first
      await FaceDetection.deleteMany({
        mediaId: { $in: mediaIdsToDelete },
      });

      // Delete media
      await Media.deleteMany({ _id: { $in: mediaIdsToDelete } });

      // Update group storage usage
      const totalSize = mediaToDelete.reduce((sum, m) => sum + m.fileSize, 0);
      await Group.updateOne(
        { _id: groupId },
        { $inc: { storageUsed: -totalSize } }
      );

      await updateJobStatus(
        jobId,
        "MEDIA_CLEANUP",
        "COMPLETED",
        100,
        undefined,
        {
          totalItems: mediaToDelete.length,
          deletedItems: mediaToDelete.length,
          freedSpace: totalSize,
          completedAt: new Date().toISOString(),
        }
      );

      console.log(
        `Cleanup job ${jobId} completed. Deleted ${mediaToDelete.length} media items.`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Cleanup job ${jobId} failed:`, error);
      await updateJobStatus(jobId, "MEDIA_CLEANUP", "FAILED", 0, errorMessage);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1,
    removeOnComplete: { count: 5 },
    removeOnFail: { count: 3 },
  }
);
