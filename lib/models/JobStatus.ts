import mongoose, { Schema } from "mongoose";
import type { IJobStatus } from "@/lib/types";

const jobStatusSchema = new Schema<IJobStatus>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    jobType: {
      type: String,
      enum: ["FACE_DETECTION", "FACE_GROUPING", "MEDIA_CLEANUP"],
      required: true,
    },
    groupId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalItems: Number,
    processedItems: {
      type: Number,
      default: 0,
    },
    errorMessage: String,
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
jobStatusSchema.index({ jobId: 1 });
jobStatusSchema.index({ status: 1, createdAt: -1 });
jobStatusSchema.index({ groupId: 1, status: 1 });

export const JobStatus =
  mongoose.models.JobStatus ||
  mongoose.model<IJobStatus>("JobStatus", jobStatusSchema);
