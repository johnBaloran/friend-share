import mongoose, { Document, Schema } from "mongoose";

export interface IFaceDetection extends Document {
  _id: string;
  mediaId: mongoose.Types.ObjectId;
  azureFaceId: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  processed: boolean;
  expiresAt: Date;
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
    azureFaceId: {
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
    processed: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
faceDetectionSchema.index({ mediaId: 1 });
faceDetectionSchema.index({ azureFaceId: 1 });
faceDetectionSchema.index({ expiresAt: 1 });
faceDetectionSchema.index({ processed: 1 });

export const FaceDetection =
  mongoose.models.FaceDetection ||
  mongoose.model<IFaceDetection>("FaceDetection", faceDetectionSchema);
