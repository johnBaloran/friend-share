import { Media } from "@/lib/models/Media";
import { Group } from "@/lib/models/Group";
import { FaceDetection } from "@/lib/models/FaceDetection";
import { CloudinaryService } from "./cloudinary";
import connectDB from "@/lib/config/database";

export interface StorageAnalytics {
  totalStorage: number;
  usedStorage: number;
  availableStorage: number;
  usagePercentage: number;
  mediaByType: {
    images: number;
    processed: number;
    unprocessed: number;
  };
  largestFiles: Array<{
    _id: string;
    filename: string;
    originalName: string;
    fileSize: number;
    createdAt: Date;
  }>;
  oldestFiles: Array<{
    _id: string;
    filename: string;
    originalName: string;
    createdAt: Date;
    fileSize: number;
  }>;
  duplicateCandidates: Array<{
    filename: string;
    count: number;
    totalSize: number;
    items: Array<{
      _id: string;
      createdAt: Date;
    }>;
  }>;
}

export interface CleanupOptions {
  deleteOlderThan?: Date;
  deleteLargerThan?: number; // bytes
  deleteUnprocessed?: boolean;
  deleteDuplicates?: boolean;
  mediaIds?: string[];
}

export class StorageService {
  static async getStorageAnalytics(groupId: string): Promise<StorageAnalytics> {
    await connectDB();

    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const [totalMedia, processedMedia, largestFiles, oldestFiles, duplicates] =
      await Promise.all([
        Media.countDocuments({ groupId }),
        Media.countDocuments({ groupId, processed: true }),
        Media.find({ groupId })
          .sort({ fileSize: -1 })
          .limit(10)
          .select("_id filename originalName fileSize createdAt"),
        Media.find({ groupId })
          .sort({ createdAt: 1 })
          .limit(10)
          .select("_id filename originalName createdAt fileSize"),
        this.findDuplicateCandidates(groupId),
      ]);

    return {
      totalStorage: group.storageLimit,
      usedStorage: group.storageUsed,
      availableStorage: group.storageLimit - group.storageUsed,
      usagePercentage: Math.round(
        (group.storageUsed / group.storageLimit) * 100
      ),
      mediaByType: {
        images: totalMedia,
        processed: processedMedia,
        unprocessed: totalMedia - processedMedia,
      },
      largestFiles,
      oldestFiles,
      duplicateCandidates: duplicates,
    };
  }

  static async findDuplicateCandidates(
    groupId: string
  ): Promise<StorageAnalytics["duplicateCandidates"]> {
    const duplicates = await Media.aggregate([
      { $match: { groupId } },
      {
        $group: {
          _id: "$originalName",
          count: { $sum: 1 },
          totalSize: { $sum: "$fileSize" },
          items: {
            $push: {
              _id: "$_id",
              createdAt: "$createdAt",
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    return duplicates.map((dup) => ({
      filename: dup._id,
      count: dup.count,
      totalSize: dup.totalSize,
      items: dup.items,
    }));
  }

  static async performCleanup(
    groupId: string,
    options: CleanupOptions
  ): Promise<{
    deletedCount: number;
    freedSpace: number;
    deletedItems: string[];
  }> {
    await connectDB();

    const query: Record<string, unknown> = { groupId };

    // Build cleanup query based on options
    if (options.deleteOlderThan) {
      query.createdAt = { $lt: options.deleteOlderThan };
    }

    if (options.deleteLargerThan) {
      query.fileSize = { $gt: options.deleteLargerThan };
    }

    if (options.deleteUnprocessed) {
      query.processed = false;
    }

    if (options.mediaIds) {
      query._id = { $in: options.mediaIds };
    }

    // Handle duplicates separately
    let mediaToDelete = [];

    if (options.deleteDuplicates) {
      const duplicates = await this.findDuplicateCandidates(groupId);
      const duplicateIds: string[] = [];

      // Keep the newest file from each duplicate group
      duplicates.forEach((duplicate) => {
        const sortedItems = duplicate.items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        // Add all but the newest to deletion list
        duplicateIds.push(...sortedItems.slice(1).map((item) => item._id));
      });

      if (duplicateIds.length > 0) {
        query._id = query._id
          ? { $in: [...(query._id as { $in: string[] }).$in, ...duplicateIds] }
          : { $in: duplicateIds };
      }
    }

    // Find media to delete
    mediaToDelete = await Media.find(query).select("_id publicId fileSize");

    if (mediaToDelete.length === 0) {
      return {
        deletedCount: 0,
        freedSpace: 0,
        deletedItems: [],
      };
    }

    const deletedIds = mediaToDelete.map((item) => item._id.toString());
    const publicIds = mediaToDelete.map((item) => item.publicId);
    const totalSize = mediaToDelete.reduce(
      (sum, item) => sum + item.fileSize,
      0
    );

    // Delete from Cloudinary
    if (publicIds.length > 0) {
      await CloudinaryService.bulkDelete(publicIds);
    }

    // Delete associated face detections
    await FaceDetection.deleteMany({
      mediaId: { $in: mediaToDelete.map((item) => item._id) },
    });

    // Delete media records
    await Media.deleteMany({
      _id: { $in: mediaToDelete.map((item) => item._id) },
    });

    // Update group storage usage
    await Group.findByIdAndUpdate(groupId, {
      $inc: { storageUsed: -totalSize },
    });

    return {
      deletedCount: mediaToDelete.length,
      freedSpace: totalSize,
      deletedItems: deletedIds,
    };
  }

  static async scheduleAutoCleanup(groupId: string): Promise<void> {
    await connectDB();

    const group = await Group.findById(groupId);
    if (!group || !group.autoDeleteDays) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - group.autoDeleteDays);

    await this.performCleanup(groupId, {
      deleteOlderThan: cutoffDate,
    });
  }
}
