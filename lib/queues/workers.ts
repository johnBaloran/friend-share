import { Worker } from "bullmq";
import { Media } from "@/lib/models/Media";
import { FaceDetection } from "@/lib/models/FaceDetection";
import { FaceCluster } from "@/lib/models/FaceCluster";
import { FaceClusterMember } from "@/lib/models/FaceClusterMember";
import { JobStatus } from "@/lib/models/JobStatus";
import { AzureFaceService } from "@/lib/services/azureFace";
import { CloudinaryService } from "@/lib/services/cloudinary";
import connectDB from "@/lib/config/database";
import redis from "@/lib/services/redis";
import { faceGroupingQueue } from "./index";
import type {
  FaceDetectionJobData,
  FaceGroupingJobData,
  CleanupJobData,
  JobType,
  JobStatus as JobStatusType,
} from "@/lib/types";

const azureFaceService = new AzureFaceService();

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

// Face Detection Worker
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

      // Get media URLs from database
      const mediaItems = await Media.find({
        _id: { $in: mediaIds },
        groupId,
      }).select("_id cloudinaryUrl filename");

      if (mediaItems.length === 0) {
        throw new Error("No valid media items found");
      }

      // Create URL to ID mapping
      const urlToIdMap = new Map<string, string>();
      const imageUrls: string[] = [];

      mediaItems.forEach((item) => {
        urlToIdMap.set(item.cloudinaryUrl, item._id.toString());
        imageUrls.push(item.cloudinaryUrl);
      });

      await updateJobStatus(
        jobId,
        "FACE_DETECTION",
        "PROCESSING",
        10,
        undefined,
        {
          totalItems: mediaItems.length,
          currentStep: "detecting_faces",
        }
      );

      // Detect faces using Azure Face API
      const detectionResults = await azureFaceService.detectFaces(imageUrls);

      let processedCount = 0;
      const totalCount = imageUrls.length;
      const allFaceDetectionIds: string[] = [];

      // Process results and store in database
      for (const [url, faces] of detectionResults.entries()) {
        const mediaId = urlToIdMap.get(url);
        if (!mediaId) continue;

        // Store face detections
        const faceDetectionPromises = faces.map(async (face) => {
          const faceDetection = await FaceDetection.create({
            mediaId,
            azureFaceId: face.faceId,
            boundingBox: face.boundingBox,
            confidence: face.confidence,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
          return faceDetection._id.toString();
        });

        const createdFaceIds = await Promise.all(faceDetectionPromises);
        allFaceDetectionIds.push(...createdFaceIds);

        // Mark media as processed
        await Media.findByIdAndUpdate(mediaId, { processed: true });

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

// Face Grouping Worker
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

      // Get face detections that haven't expired
      const faceDetections = await FaceDetection.find({
        _id: { $in: faceDetectionIds },
        expiresAt: { $gt: new Date() },
        processed: false,
      }).select("_id azureFaceId");

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

      const faceIds = faceDetections.map((f) => f.azureFaceId);
      const faceIdToDetectionId = new Map<string, string>();

      faceDetections.forEach((f) => {
        faceIdToDetectionId.set(f.azureFaceId, f._id.toString());
      });

      await updateJobStatus(
        jobId,
        "FACE_GROUPING",
        "PROCESSING",
        20,
        undefined,
        {
          totalFaces: faceIds.length,
          currentStep: "grouping_faces",
        }
      );

      // Group faces using Azure Face API
      let groupingResults;

      if (faceIds.length <= 1000) {
        groupingResults = [await azureFaceService.groupFaces(faceIds)];
      } else {
        groupingResults = await azureFaceService.batchGroupFaces(faceIds);
      }

      await updateJobStatus(
        jobId,
        "FACE_GROUPING",
        "PROCESSING",
        60,
        undefined,
        {
          totalFaces: faceIds.length,
          currentStep: "creating_clusters",
        }
      );

      // Process grouping results
      let clustersCreated = 0;
      let facesGrouped = 0;

      for (const result of groupingResults) {
        // Create clusters for grouped faces
        for (const group of result.groups) {
          if (group.length < 2) continue; // Skip single-face groups

          const cluster = await FaceCluster.create({
            groupId,
            appearanceCount: group.length,
            confidence: 0.8, // Default confidence
          });

          // Add faces to cluster
          const clusterMemberPromises = group
            .map((faceId) => faceIdToDetectionId.get(faceId))
            .filter((detectionId): detectionId is string =>
              Boolean(detectionId)
            )
            .map((detectionId) =>
              FaceClusterMember.create({
                clusterId: cluster._id,
                faceDetectionId: detectionId,
                confidence: 0.8,
              })
            );

          await Promise.all(clusterMemberPromises);
          clustersCreated++;
          facesGrouped += group.length;
        }

        // Handle messy group (uncertain faces) - create individual clusters
        for (const faceId of result.messyGroup) {
          const detectionId = faceIdToDetectionId.get(faceId);
          if (!detectionId) continue;

          const cluster = await FaceCluster.create({
            groupId,
            appearanceCount: 1,
            confidence: 0.5, // Lower confidence for uncertain faces
          });

          await FaceClusterMember.create({
            clusterId: cluster._id,
            faceDetectionId: detectionId,
            confidence: 0.5,
          });

          clustersCreated++;
          facesGrouped++;
        }
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
          totalFaces: faceIds.length,
          clustersCreated,
          facesGrouped,
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

// Cleanup Worker
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
        }).select("_id publicId fileSize");
      } else {
        // Delete all media older than target date
        mediaToDelete = await Media.find({
          groupId,
          createdAt: { $lt: targetDate },
        }).select("_id publicId fileSize");
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
          currentStep: "deleting_from_cloudinary",
        }
      );

      // Delete from Cloudinary
      const publicIds = mediaToDelete.map((m) => m.publicId);
      await CloudinaryService.bulkDelete(publicIds);

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
      await Media.deleteMany({ _id: { $in: mediaIdsToDelete } });

      // Update group storage usage
      const totalSize = mediaToDelete.reduce((sum, m) => sum + m.fileSize, 0);
      await Media.updateOne(
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
