import mongoose, { Document, Schema } from "mongoose";

export interface IFaceClusterMember extends Document {
  _id: string;
  clusterId: mongoose.Types.ObjectId;
  faceDetectionId: mongoose.Types.ObjectId;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

const faceClusterMemberSchema = new Schema<IFaceClusterMember>(
  {
    clusterId: {
      type: Schema.Types.ObjectId,
      ref: "FaceCluster",
      required: true,
    },
    faceDetectionId: {
      type: Schema.Types.ObjectId,
      ref: "FaceDetection",
      required: true,
    },
    confidence: {
      type: Number,
      default: 1.0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for uniqueness and performance
faceClusterMemberSchema.index(
  { clusterId: 1, faceDetectionId: 1 },
  { unique: true }
);
faceClusterMemberSchema.index({ clusterId: 1 });
faceClusterMemberSchema.index({ faceDetectionId: 1 });

export const FaceClusterMember =
  mongoose.models.FaceClusterMember ||
  mongoose.model<IFaceClusterMember>(
    "FaceClusterMember",
    faceClusterMemberSchema
  );
