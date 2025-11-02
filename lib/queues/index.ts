import { Queue, Job } from "bullmq";
import redis from "@/lib/services/redis";
import type {
  FaceDetectionJobData,
  FaceGroupingJobData,
  CleanupJobData,
} from "@/lib/types";

if (!redis) {
  throw new Error("Redis connection not configured. Please set REDIS_URL environment variable.");
}

// Queue configurations
const defaultJobOptions = {
  removeOnComplete: 10,
  removeOnFail: 5,
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2000,
  },
};

// Create queues with proper typing
export const faceDetectionQueue = new Queue<FaceDetectionJobData>(
  "face-detection",
  {
    connection: redis,
    defaultJobOptions,
  }
);

export const faceGroupingQueue = new Queue<FaceGroupingJobData>(
  "face-grouping",
  {
    connection: redis,
    defaultJobOptions: {
      ...defaultJobOptions,
      priority: 10, // High priority due to 24h expiration
    },
  }
);

export const cleanupQueue = new Queue<CleanupJobData>("cleanup", {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1, // Don't retry cleanup jobs
  },
});

// Export types for workers
export type FaceDetectionJob = Job<FaceDetectionJobData>;
export type FaceGroupingJob = Job<FaceGroupingJobData>;
export type CleanupJob = Job<CleanupJobData>;
