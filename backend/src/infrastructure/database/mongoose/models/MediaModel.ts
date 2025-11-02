import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMediaDocument extends Document {
  groupId: Types.ObjectId;
  uploaderId: string; // Clerk user ID
  filename: string;
  originalName: string;
  s3Key: string;
  s3Bucket: string;
  url: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IMediaDocument>(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    uploaderId: {
      type: String,
      required: true,
      index: true,
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
      unique: true,
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
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for queries
mediaSchema.index({ groupId: 1, createdAt: -1 });
mediaSchema.index({ processed: 1, createdAt: 1 });

export const MediaModel = mongoose.model<IMediaDocument>('Media', mediaSchema);
