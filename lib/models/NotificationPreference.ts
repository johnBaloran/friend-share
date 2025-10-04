import mongoose, { Document, Schema } from "mongoose";

export interface INotificationPreference extends Document {
  userId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  preferences: {
    uploads: boolean;
    faceDetection: boolean;
    memberActivity: boolean;
    downloads: boolean;
    emailDigest: boolean;
  };
  digestFrequency: "DAILY" | "WEEKLY" | "NEVER";
  lastDigestSent?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    preferences: {
      uploads: {
        type: Boolean,
        default: true,
      },
      faceDetection: {
        type: Boolean,
        default: true,
      },
      memberActivity: {
        type: Boolean,
        default: true,
      },
      downloads: {
        type: Boolean,
        default: false,
      },
      emailDigest: {
        type: Boolean,
        default: true,
      },
    },
    digestFrequency: {
      type: String,
      enum: ["DAILY", "WEEKLY", "NEVER"],
      default: "WEEKLY",
    },
    lastDigestSent: Date,
  },
  {
    timestamps: true,
  }
);

// Ensure one preference record per user per group
notificationPreferenceSchema.index({ userId: 1, groupId: 1 }, { unique: true });

export const NotificationPreference =
  mongoose.models.NotificationPreference ||
  mongoose.model<INotificationPreference>(
    "NotificationPreference",
    notificationPreferenceSchema
  );
