import mongoose, { Document, Schema } from "mongoose";

export interface IMedia extends Document {
  _id: string;
  groupId: mongoose.Types.ObjectId;
  uploaderId: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  s3Key: string; // S3 object key
  s3Bucket: string; // S3 bucket name
  url: string; // Public URL to the file
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    uploaderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    s3Bucket: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    width: Number,
    height: Number,
    processed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
mediaSchema.index({ groupId: 1, createdAt: -1 });
mediaSchema.index({ uploaderId: 1 });
mediaSchema.index({ processed: 1 });

export const Media =
  mongoose.models.Media || mongoose.model<IMedia>("Media", mediaSchema);
