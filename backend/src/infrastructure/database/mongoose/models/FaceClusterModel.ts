import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFaceClusterDocument extends Document {
  groupId: Types.ObjectId;
  clusterName?: string;
  appearanceCount: number;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

const faceClusterSchema = new Schema<IFaceClusterDocument>(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      index: true,
    },
    clusterName: {
      type: String,
      trim: true,
    },
    appearanceCount: {
      type: Number,
      required: true,
      default: 0,
    },
    confidence: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for sorting by appearance count
faceClusterSchema.index({ groupId: 1, appearanceCount: -1 });

export const FaceClusterModel = mongoose.model<IFaceClusterDocument>(
  'FaceCluster',
  faceClusterSchema
);
