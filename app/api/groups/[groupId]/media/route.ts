import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Media, IMedia } from "@/lib/models/Media";
import { Group } from "@/lib/models/Group";
import { IUser } from "@/lib/models/User";
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

    return Response.json({
      success: true,
      data: {
        media: media.map((item: PopulatedMedia) => ({
          _id: item._id,
          filename: item.filename,
          originalName: item.originalName,
          cloudinaryUrl: item.cloudinaryUrl,
          createdAt: item.createdAt,
          uploader: {
            name: item.uploaderId.name,
            email: item.uploaderId.email,
          },
          fileSize: item.fileSize,
          processed: item.processed,
        })),
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
