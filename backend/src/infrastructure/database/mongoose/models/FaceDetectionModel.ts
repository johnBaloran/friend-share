import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFaceDetectionDocument extends Document {
  mediaId: Types.ObjectId;
  rekognitionFaceId: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  quality?: {
    brightness: number;
    sharpness: number;
  };
  pose?: {
    roll: number;
    yaw: number;
    pitch: number;
  };
  qualityScore?: number;
  enhancedFace?: {
    s3Key: string;
    s3Bucket: string;
    width: number;
    height: number;
  };
  processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const faceDetectionSchema = new Schema<IFaceDetectionDocument>(
  {
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: 'Media',
      required: true,
      index: true,
    },
    rekognitionFaceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    boundingBox: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    confidence: {
      type: Number,
      required: true,
    },
    quality: {
      brightness: { type: Number },
      sharpness: { type: Number },
    },
    pose: {
      roll: { type: Number },
      yaw: { type: Number },
      pitch: { type: Number },
    },
    qualityScore: {
      type: Number,
    },
    enhancedFace: {
      s3Key: { type: String },
      s3Bucket: { type: String },
      width: { type: Number },
      height: { type: Number },
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

// Indexes for queries
faceDetectionSchema.index({ processed: 1, createdAt: 1 });

export const FaceDetectionModel = mongoose.model<IFaceDetectionDocument>(
  'FaceDetection',
  faceDetectionSchema
);
