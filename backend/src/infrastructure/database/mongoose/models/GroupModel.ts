import mongoose, { Schema, Document } from 'mongoose';
import { MemberRoleType } from '../../../../shared/types/index.js';

export interface IGroupMemberDocument {
  userId: string | mongoose.Types.ObjectId; // Reference to User or Clerk user ID
  role: MemberRoleType;
  permissions: {
    canUpload: boolean;
    canDownload: boolean;
    canDelete: boolean;
  };
  joinedAt: Date;
}

export interface IGroupDocument extends Document {
  name: string;
  description?: string;
  inviteCode: string;
  creatorId: string; // Clerk user ID
  members: IGroupMemberDocument[];
  storageLimit: number;
  storageUsed: number;
  autoDeleteDays: number;
  rekognitionCollectionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const groupMemberSchema = new Schema<IGroupMemberDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MEMBER', 'VIEWER'],
      required: true,
    },
    permissions: {
      canUpload: { type: Boolean, default: true },
      canDownload: { type: Boolean, default: true },
      canDelete: { type: Boolean, default: false },
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const groupSchema = new Schema<IGroupDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    creatorId: {
      type: String,
      required: true,
      index: true,
    },
    members: [groupMemberSchema],
    storageLimit: {
      type: Number,
      default: 1073741824, // 1GB
    },
    storageUsed: {
      type: Number,
      default: 0,
    },
    autoDeleteDays: {
      type: Number,
      default: 30,
    },
    rekognitionCollectionId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding groups by member
groupSchema.index({ 'members.userId': 1 });

export const GroupModel = mongoose.model<IGroupDocument>('Group', groupSchema);
