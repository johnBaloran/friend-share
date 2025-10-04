import { Activity } from "@/lib/models/Activity";
import {
  INotificationPreference,
  NotificationPreference,
} from "../models/NotificationPreference";
import { User } from "@/lib/models/User";
import connectDB from "@/lib/config/database";
import mongoose from "mongoose";

export interface ActivityData {
  userId: string;
  groupId: string;
  type:
    | "UPLOAD"
    | "FACE_DETECTED"
    | "MEMBER_JOINED"
    | "MEMBER_LEFT"
    | "CLUSTER_NAMED"
    | "DOWNLOAD";
  title: string;
  description: string;
  metadata?: {
    mediaCount?: number;
    facesDetected?: number;
    clustersCreated?: number;
    memberName?: string;
    clusterName?: string;
    downloadCount?: number;
  };
}

export interface ActivityFeedItem {
  _id: string;
  user: {
    _id: string;
    name?: string;
    email: string;
    avatar?: string;
  };
  type: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  timeAgo: string;
}

export class ActivityService {
  static async recordActivity(data: ActivityData): Promise<void> {
    await connectDB();

    await Activity.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      groupId: new mongoose.Types.ObjectId(data.groupId),
      type: data.type,
      title: data.title,
      description: data.description,
      metadata: data.metadata || {},
    });
  }

  static async getGroupActivities(
    groupId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    activities: ActivityFeedItem[];
    hasMore: boolean;
    total: number;
  }> {
    await connectDB();

    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      Activity.find({ groupId })
        .populate("userId", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Activity.countDocuments({ groupId }),
    ]);

    const formattedActivities = activities.map((activity) => ({
      _id: activity._id.toString(),
      user: {
        _id: activity.userId._id.toString(),
        name: activity.userId.name,
        email: activity.userId.email,
        avatar: activity.userId.avatar,
      },
      type: activity.type,
      title: activity.title,
      description: activity.description,
      metadata: activity.metadata,
      createdAt: activity.createdAt.toISOString(),
      timeAgo: this.formatTimeAgo(activity.createdAt),
    }));

    return {
      activities: formattedActivities,
      hasMore: skip + activities.length < total,
      total,
    };
  }

  static async getUserNotificationPreferences(
    userId: string,
    groupId: string
  ): Promise<INotificationPreference | null> {
    await connectDB();

    let preferences = await NotificationPreference.findOne({ userId, groupId });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await NotificationPreference.create({
        userId: new mongoose.Types.ObjectId(userId),
        groupId: new mongoose.Types.ObjectId(groupId),
        preferences: {
          uploads: true,
          faceDetection: true,
          memberActivity: true,
          downloads: false,
          emailDigest: true,
        },
        digestFrequency: "WEEKLY",
      });
    }

    return preferences;
  }

  static async updateNotificationPreferences(
    userId: string,
    groupId: string,
    preferences: {
      uploads?: boolean;
      faceDetection?: boolean;
      memberActivity?: boolean;
      downloads?: boolean;
      emailDigest?: boolean;
    },
    digestFrequency?: "DAILY" | "WEEKLY" | "NEVER"
  ): Promise<void> {
    await connectDB();

    await NotificationPreference.findOneAndUpdate(
      { userId, groupId },
      {
        $set: {
          preferences: {
            ...preferences,
          },
          ...(digestFrequency && { digestFrequency }),
        },
      },
      { upsert: true, new: true }
    );
  }

  static async recordUploadActivity(
    userId: string,
    groupId: string,
    mediaCount: number
  ): Promise<void> {
    const user = await User.findById(userId);
    const userName = user?.name || user?.email || "Someone";

    await this.recordActivity({
      userId,
      groupId,
      type: "UPLOAD",
      title: "Photos Uploaded",
      description: `${userName} uploaded ${mediaCount} photo${
        mediaCount > 1 ? "s" : ""
      }`,
      metadata: { mediaCount },
    });
  }

  static async recordFaceDetectionActivity(
    userId: string,
    groupId: string,
    facesDetected: number,
    clustersCreated: number
  ): Promise<void> {
    await this.recordActivity({
      userId,
      groupId,
      type: "FACE_DETECTED",
      title: "Faces Detected",
      description: `Found ${facesDetected} face${
        facesDetected > 1 ? "s" : ""
      } and identified ${clustersCreated} people`,
      metadata: { facesDetected, clustersCreated },
    });
  }

  static async recordMemberActivity(
    userId: string,
    groupId: string,
    memberName: string,
    action: "joined" | "left"
  ): Promise<void> {
    await this.recordActivity({
      userId,
      groupId,
      type: action === "joined" ? "MEMBER_JOINED" : "MEMBER_LEFT",
      title: action === "joined" ? "Member Joined" : "Member Left",
      description: `${memberName} ${action} the group`,
      metadata: { memberName },
    });
  }

  static async recordClusterNamingActivity(
    userId: string,
    groupId: string,
    clusterName: string
  ): Promise<void> {
    const user = await User.findById(userId);
    const userName = user?.name || user?.email || "Someone";

    await this.recordActivity({
      userId,
      groupId,
      type: "CLUSTER_NAMED",
      title: "Person Named",
      description: `${userName} named a person "${clusterName}"`,
      metadata: { clusterName },
    });
  }

  private static formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 2419200)
      return `${Math.floor(diffInSeconds / 604800)}w ago`;
    return `${Math.floor(diffInSeconds / 2419200)}mo ago`;
  }

  static async cleanOldActivities(olderThanDays: number = 90): Promise<void> {
    await connectDB();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    await Activity.deleteMany({
      createdAt: { $lt: cutoffDate },
    });
  }
}
