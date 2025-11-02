import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFaceClusterMemberDocument extends Document {
  clusterId: Types.ObjectId;
  faceDetectionId: Types.ObjectId;
  confidence: number;
  createdAt: Date;
}

const faceClusterMemberSchema = new Schema<IFaceClusterMemberDocument>(
  {
    clusterId: {
      type: Schema.Types.ObjectId,
      ref: 'FaceCluster',
      required: true,
      index: true,
    },
    faceDetectionId: {
      type: Schema.Types.ObjectId,
      ref: 'FaceDetection',
      required: true,
      unique: true,
      index: true,
    },
    confidence: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for cluster queries
faceClusterMemberSchema.index({ clusterId: 1, confidence: -1 });

export const FaceClusterMemberModel = mongoose.model<IFaceClusterMemberDocument>(
  'FaceClusterMember',
  faceClusterMemberSchema
);
