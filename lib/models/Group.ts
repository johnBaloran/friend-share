import mongoose, { Document, Schema } from "mongoose";

export interface IGroupMember {
  userId: mongoose.Types.ObjectId;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  permissions: {
    canUpload: boolean;
    canDownload: boolean;
    canDelete: boolean;
  };
  joinedAt: Date;
}

export interface IGroup extends Document {
  _id: string;
  name: string;
  description?: string;
  inviteCode: string;
  creatorId: mongoose.Types.ObjectId;
  members: IGroupMember[];
  storageLimit: number;
  storageUsed: number;
  autoDeleteDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const groupMemberSchema = new Schema<IGroupMember>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: ["ADMIN", "MEMBER", "VIEWER"],
    default: "MEMBER",
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
});

const groupSchema = new Schema<IGroup>(
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
      unique: true,
      required: true,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
  },
  {
    timestamps: true,
  }
);

// Indexes
// groupSchema.index({ inviteCode: 1 });
groupSchema.index({ creatorId: 1 });
groupSchema.index({ "members.userId": 1 });

export const Group =
  mongoose.models.Group || mongoose.model<IGroup>("Group", groupSchema);
