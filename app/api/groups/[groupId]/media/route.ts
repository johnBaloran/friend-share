import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Media, IMedia } from "@/lib/models/Media";
import { Group } from "@/lib/models/Group";
import { IUser } from "@/lib/models/User";
import { getPresignedUrl } from "@/lib/services/s3";
import connectDB from "@/lib/config/database";
import mongoose from "mongoose";

// Define the populated media type
interface PopulatedMedia extends Omit<IMedia, "uploaderId"> {
  uploaderId: IUser;
}

// Define the query type
interface MediaQuery {
  groupId: string;
  // Add future cluster filtering here when implemented
  clusterId?: mongoose.Types.ObjectId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const authResult = await createAuthMiddleware(true)();

  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  if (!user) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { groupId } = await params; // Fixed

  try {
    await connectDB();

    // Check if user is member of group
    const group = await Group.findOne({
      _id: groupId,
      "members.userId": user._id,
    });

    if (!group) {
      return Response.json(
        { success: false, error: "Group not found or access denied" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const clusterId = searchParams.get("clusterId");

    // Use properly typed query object
    const query: MediaQuery = { groupId };

    // Filter by face cluster if specified
    if (clusterId) {
      // This will be implemented when we add face detection
      query.clusterId = new mongoose.Types.ObjectId(clusterId);
    }

    const skip = (page - 1) * limit;

    const [media, total] = await Promise.all([
      Media.find(query)
        .populate("uploaderId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit) as Promise<PopulatedMedia[]>,
      Media.countDocuments(query),
    ]);

    // Generate presigned URLs for all media items
    const mediaWithPresignedUrls = await Promise.all(
      media.map(async (item: PopulatedMedia) => {
        try {
          const presignedUrl = await getPresignedUrl(item.s3Key, 3600); // 1 hour expiry
          return {
            _id: item._id,
            filename: item.filename,
            originalName: item.originalName,
            cloudinaryUrl: presignedUrl, // Use presigned URL
            url: presignedUrl,
            s3Key: item.s3Key,
            s3Bucket: item.s3Bucket,
            createdAt: item.createdAt,
            uploader: {
              name: item.uploaderId.name,
              email: item.uploaderId.email,
            },
            fileSize: item.fileSize,
            processed: item.processed,
          };
        } catch (error) {
          console.error(
            `Failed to generate presigned URL for ${item.s3Key}:`,
            error
          );
          // Return item without URL if presigned URL generation fails
          return {
            _id: item._id,
            filename: item.filename,
            originalName: item.originalName,
            cloudinaryUrl: "",
            url: "",
            s3Key: item.s3Key,
            s3Bucket: item.s3Bucket,
            createdAt: item.createdAt,
            uploader: {
              name: item.uploaderId.name,
              email: item.uploaderId.email,
            },
            fileSize: item.fileSize,
            processed: item.processed,
          };
        }
      })
    );

    return Response.json({
      success: true,
      data: {
        media: mediaWithPresignedUrls,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get media error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch media" },
      { status: 500 }
    );
  }
}
