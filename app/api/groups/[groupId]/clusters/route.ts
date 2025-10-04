import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { FaceCluster } from "@/lib/models/FaceCluster";

import connectDB from "@/lib/config/database";
import type { ApiResponse } from "@/lib/types";

interface ClusterWithSample {
  _id: string;
  clusterName?: string;
  appearanceCount: number;
  confidence: number;
  createdAt: Date;
  samplePhoto?: {
    cloudinaryUrl: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  totalPhotos: number;
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
      { success: false, error: "Unauthorized" } satisfies ApiResponse,
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
        {
          success: false,
          error: "Group not found or access denied",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // Get face clusters with sample photos
    const clusters = await FaceCluster.aggregate([
      { $match: { groupId } },
      {
        $lookup: {
          from: "faceclustermembers",
          localField: "_id",
          foreignField: "clusterId",
          as: "members",
        },
      },
      {
        $lookup: {
          from: "facedetections",
          localField: "members.faceDetectionId",
          foreignField: "_id",
          as: "faceDetections",
        },
      },
      {
        $lookup: {
          from: "media",
          localField: "faceDetections.mediaId",
          foreignField: "_id",
          as: "mediaItems",
        },
      },
      {
        $addFields: {
          totalPhotos: { $size: "$mediaItems" },
          samplePhoto: {
            $let: {
              vars: {
                firstFace: { $arrayElemAt: ["$faceDetections", 0] },
                firstMedia: { $arrayElemAt: ["$mediaItems", 0] },
              },
              in: {
                cloudinaryUrl: "$$firstMedia.cloudinaryUrl",
                boundingBox: "$$firstFace.boundingBox",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          clusterName: 1,
          appearanceCount: 1,
          confidence: 1,
          createdAt: 1,
          samplePhoto: 1,
          totalPhotos: 1,
        },
      },
      { $sort: { appearanceCount: -1, createdAt: -1 } },
    ]);

    return Response.json({
      success: true,
      data: clusters,
    } satisfies ApiResponse<ClusterWithSample[]>);
  } catch (error) {
    console.error("Get clusters error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch face clusters",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
