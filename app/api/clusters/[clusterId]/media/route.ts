import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { FaceCluster } from "@/lib/models/FaceCluster";
import { FaceClusterMember } from "@/lib/models/FaceClusterMember";
import { FaceDetection } from "@/lib/models/FaceDetection";
import { Media } from "@/lib/models/Media";
import { getPresignedUrl } from "@/lib/services/s3";
import connectDB from "@/lib/config/database";
import type { ApiResponse } from "@/lib/types";

interface MediaWithFaceInfo {
  _id: string;
  filename: string;
  originalName: string;
  cloudinaryUrl: string;
  url: string;
  s3Key: string;
  s3Bucket: string;
  createdAt: string;
  uploader: {
    name?: string;
    email: string;
  };
  fileSize: number;
  processed: boolean;
  faceDetections: Array<{
    _id: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence: number;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
): Promise<Response> {
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

  const { clusterId } = await params;

  try {
    await connectDB();

    // Get the cluster and verify access
    const cluster = await FaceCluster.findById(clusterId);

    if (!cluster) {
      return Response.json(
        { success: false, error: "Cluster not found" } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // Check if user has access to the group
    const group = await Group.findOne({
      _id: cluster.groupId,
      "members.userId": user._id,
    });

    if (!group) {
      return Response.json(
        { success: false, error: "Access denied" } satisfies ApiResponse,
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get all face detections for this cluster
    const clusterMembers = await FaceClusterMember.find({ clusterId }).populate(
      "faceDetectionId"
    );

    const faceDetectionIds = clusterMembers
      .map((member) => member.faceDetectionId)
      .filter(Boolean)
      .map((detection) => detection._id);

    // Get all media that contains faces from this cluster
    const faceDetections = await FaceDetection.find({
      _id: { $in: faceDetectionIds },
    });

    const mediaIds = [
      ...new Set(faceDetections.map((detection) => detection.mediaId)),
    ];

    // Get media with pagination
    const [media, total] = await Promise.all([
      Media.find({ _id: { $in: mediaIds } })
        .populate("uploaderId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Media.countDocuments({ _id: { $in: mediaIds } }),
    ]);

    // Attach face detection info to each media item and generate presigned URLs
    const mediaWithFaces: MediaWithFaceInfo[] = await Promise.all(
      media.map(async (item) => {
        const itemFaceDetections = faceDetections
          .filter(
            (detection) => detection.mediaId.toString() === item._id.toString()
          )
          .map((detection) => ({
            _id: detection._id.toString(),
            boundingBox: detection.boundingBox,
            confidence: detection.confidence,
          }));

        try {
          const presignedUrl = await getPresignedUrl(item.s3Key, 3600); // 1 hour expiry
          return {
            _id: item._id.toString(),
            filename: item.filename,
            originalName: item.originalName,
            cloudinaryUrl: presignedUrl, // Use presigned URL
            url: presignedUrl,
            s3Key: item.s3Key,
            s3Bucket: item.s3Bucket,
            createdAt: item.createdAt.toISOString(),
            uploader: {
              name: item.uploaderId.name,
              email: item.uploaderId.email,
            },
            fileSize: item.fileSize,
            processed: item.processed,
            faceDetections: itemFaceDetections,
          };
        } catch (error) {
          console.error(
            `Failed to generate presigned URL for ${item.s3Key}:`,
            error
          );
          return {
            _id: item._id.toString(),
            filename: item.filename,
            originalName: item.originalName,
            cloudinaryUrl: "",
            url: "",
            s3Key: item.s3Key,
            s3Bucket: item.s3Bucket,
            createdAt: item.createdAt.toISOString(),
            uploader: {
              name: item.uploaderId.name,
              email: item.uploaderId.email,
            },
            fileSize: item.fileSize,
            processed: item.processed,
            faceDetections: itemFaceDetections,
          };
        }
      })
    );

    return Response.json({
      success: true,
      data: {
        media: mediaWithFaces,
        cluster: {
          _id: cluster._id,
          clusterName: cluster.clusterName,
          appearanceCount: cluster.appearanceCount,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Get cluster media error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch cluster media",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
