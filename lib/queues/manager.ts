import { JobStatus } from "@/lib/models/JobStatus";
import connectDB from "@/lib/config/database";
import { faceDetectionQueue, faceGroupingQueue, cleanupQueue } from "./index";

import type {
  FaceDetectionJobData,
  FaceGroupingJobData,
  CleanupJobData,
  IJobStatus,
} from "@/lib/types";
import {
  faceDetectionWorker,
  faceGroupingWorker,
  cleanupWorker,
} from "./workers";

// Define queue stats interface
interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export class QueueManager {
  private static workers = [
    faceDetectionWorker,
    faceGroupingWorker,
    cleanupWorker,
  ];

  static async startWorkers(): Promise<void> {
    console.log("Starting job queue workers...");

    // Workers are already instantiated and listening
    console.log("Face detection worker started");
    console.log("Face grouping worker started");
    console.log("Cleanup worker started");

    // Graceful shutdown handling
    process.on("SIGTERM", async () => {
      console.log("Shutting down workers...");
      await this.stopWorkers();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("Shutting down workers...");
      await this.stopWorkers();
      process.exit(0);
    });
  }

  static async stopWorkers(): Promise<void> {
    const stopPromises = this.workers.map((worker) => worker.close());
    await Promise.all(stopPromises);
    console.log("All workers stopped");
  }

  static async addFaceDetectionJob(
    data: FaceDetectionJobData
  ): Promise<string> {
    const job = await faceDetectionQueue.add("FACE_DETECTION", data, {
      priority: 5,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 5 },
    });

    const jobId = job.id!;

    // Create initial job status record
    await connectDB();
    await JobStatus.create({
      jobId,
      jobType: "FACE_DETECTION",
      groupId: data.groupId,
      status: "PENDING",
      progress: 0,
      totalItems: data.mediaIds.length,
      processedItems: 0,
      metadata: {
        mediaIds: data.mediaIds,
        userId: data.userId,
      },
    });

    console.log(
      `Face detection job ${jobId} queued for ${data.mediaIds.length} media items`
    );
    return jobId;
  }

  static async addFaceGroupingJob(data: FaceGroupingJobData): Promise<string> {
    const job = await faceGroupingQueue.add("FACE_GROUPING", data, {
      priority: 10, // High priority due to 24h expiration
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 5 },
    });

    const jobId = job.id!;

    // Create initial job status record
    await connectDB();
    await JobStatus.create({
      jobId,
      jobType: "FACE_GROUPING",
      groupId: data.groupId,
      status: "PENDING",
      progress: 0,
      totalItems: data.faceDetectionIds.length,
      processedItems: 0,
      metadata: {
        faceDetectionIds: data.faceDetectionIds,
        userId: data.userId,
      },
    });

    console.log(
      `Face grouping job ${jobId} queued for ${data.faceDetectionIds.length} face detections`
    );
    return jobId;
  }

  static async addCleanupJob(
    data: CleanupJobData,
    delay?: number
  ): Promise<string> {
    const job = await cleanupQueue.add("MEDIA_CLEANUP", data, {
      delay,
      priority: 1,
      removeOnComplete: { count: 5 },
      removeOnFail: { count: 3 },
    });

    const jobId = job.id!;

    // Create initial job status record
    await connectDB();
    await JobStatus.create({
      jobId,
      jobType: "MEDIA_CLEANUP",
      groupId: data.groupId,
      status: "PENDING",
      progress: 0,
      metadata: {
        targetDate: data.targetDate.toISOString(),
        mediaIds: data.mediaIds,
        userId: data.userId,
      },
    });

    console.log(`Cleanup job ${jobId} queued for group ${data.groupId}`);
    return jobId;
  }

  static async getJobStatus(jobId: string): Promise<IJobStatus | null> {
    await connectDB();
    const result = await JobStatus.findOne({ jobId }).lean();
    return result as IJobStatus | null;
  }

  static async getGroupJobs(groupId: string): Promise<IJobStatus[]> {
    await connectDB();
    const results = await JobStatus.find({ groupId })
      .sort({ createdAt: -1 })
      .limit(50);
    return results as IJobStatus[];
  }

  static async getQueueStats(): Promise<{
    faceDetection: QueueStats;
    faceGrouping: QueueStats;
    cleanup: QueueStats;
  }> {
    const [faceDetectionStats, faceGroupingStats, cleanupStats] =
      await Promise.all([
        faceDetectionQueue.getJobCounts(),
        faceGroupingQueue.getJobCounts(),
        cleanupQueue.getJobCounts(),
      ]);

    return {
      faceDetection: {
        waiting: faceDetectionStats.waiting || 0,
        active: faceDetectionStats.active || 0,
        completed: faceDetectionStats.completed || 0,
        failed: faceDetectionStats.failed || 0,
      },
      faceGrouping: {
        waiting: faceGroupingStats.waiting || 0,
        active: faceGroupingStats.active || 0,
        completed: faceGroupingStats.completed || 0,
        failed: faceGroupingStats.failed || 0,
      },
      cleanup: {
        waiting: cleanupStats.waiting || 0,
        active: cleanupStats.active || 0,
        completed: cleanupStats.completed || 0,
        failed: cleanupStats.failed || 0,
      },
    };
  }

  static async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Try to find and cancel the job in all queues
      const queues = [faceDetectionQueue, faceGroupingQueue, cleanupQueue];

      for (const queue of queues) {
        const job = await queue.getJob(jobId);
        if (job) {
          await job.remove();

          // Update job status
          await connectDB();
          await JobStatus.findOneAndUpdate(
            { jobId },
            {
              status: "CANCELLED",
              updatedAt: new Date(),
            }
          );

          console.log(`Job ${jobId} cancelled`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }
}
