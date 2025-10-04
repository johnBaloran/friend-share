import mongoose, { Document, Schema } from "mongoose";

export interface IActivity extends Document {
  userId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  type:
    | "UPLOAD"
    | "FACE_DETECTED"
    | "MEMBER_JOINED"
    | "MEMBER_LEFT"
    | "CLUSTER_NAMED"
    | "DOWNLOAD";
  title: string;
  description: string;
  metadata: {
    mediaCount?: number;
    facesDetected?: number;
    clustersCreated?: number;
    memberName?: string;
    clusterName?: string;
    downloadCount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "UPLOAD",
        "FACE_DETECTED",
        "MEMBER_JOINED",
        "MEMBER_LEFT",
        "CLUSTER_NAMED",
        "DOWNLOAD",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      mediaCount: Number,
      facesDetected: Number,
      clustersCreated: Number,
      memberName: String,
      clusterName: String,
      downloadCount: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
activitySchema.index({ groupId: 1, createdAt: -1 });
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });

export const Activity =
  mongoose.models.Activity ||
  mongoose.model<IActivity>("Activity", activitySchema);
