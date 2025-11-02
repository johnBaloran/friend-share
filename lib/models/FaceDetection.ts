import mongoose, { Document, Schema } from "mongoose";

export interface IFaceDetection extends Document {
  _id: string;
  mediaId: mongoose.Types.ObjectId;
  rekognitionFaceId: string; // AWS Rekognition Face ID
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  quality?: {
    brightness: number; // 0-100
    sharpness: number;  // 0-100
  };
  pose?: {
    roll: number;  // Head tilt (-180 to 180)
    yaw: number;   // Face turned left/right (-180 to 180)
    pitch: number; // Looking up/down (-180 to 180)
  };
  qualityScore?: number; // Computed overall quality (0-100)
  enhancedFace?: {
    s3Key: string;      // S3 key for enhanced face image
    s3Bucket: string;   // S3 bucket for enhanced face
    width: number;      // Enhanced image width (typically 600)
    height: number;     // Enhanced image height (typically 600)
  };
  processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const faceDetectionSchema = new Schema<IFaceDetection>(
  {
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      required: true,
    },
    rekognitionFaceId: {
      type: String,
      required: true,
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
      index: true, // Index for efficient sorting by quality
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
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
faceDetectionSchema.index({ mediaId: 1 });
faceDetectionSchema.index({ rekognitionFaceId: 1 });
faceDetectionSchema.index({ processed: 1 });

export const FaceDetection =
  mongoose.models.FaceDetection ||
  mongoose.model<IFaceDetection>("FaceDetection", faceDetectionSchema);
