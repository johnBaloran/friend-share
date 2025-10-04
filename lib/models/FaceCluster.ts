import mongoose, { Document, Schema } from "mongoose";

export interface IFaceCluster extends Document {
  _id: string;
  groupId: mongoose.Types.ObjectId;
  clusterName?: string;
  appearanceCount: number;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

const faceClusterSchema = new Schema<IFaceCluster>(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    clusterName: {
      type: String,
      trim: true,
    },
    appearanceCount: {
      type: Number,
      default: 0,
    },
    confidence: {
      type: Number,
      default: 0.0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
faceClusterSchema.index({ groupId: 1, appearanceCount: -1 });

export const FaceCluster =
  mongoose.models.FaceCluster ||
  mongoose.model<IFaceCluster>("FaceCluster", faceClusterSchema);
