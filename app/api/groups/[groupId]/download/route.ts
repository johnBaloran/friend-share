import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { Media } from "@/lib/models/Media";
import { FaceCluster } from "@/lib/models/FaceCluster";
import { FaceClusterMember } from "@/lib/models/FaceClusterMember";
import { FaceDetection } from "@/lib/models/FaceDetection";
import { DownloadService } from "@/lib/services/downloadService";
import connectDB from "@/lib/config/database";
import type { ApiResponse } from "@/lib/types";

interface DownloadRequestBody {
  mediaIds?: string[];
  clusterId?: string;
  downloadType: "selected" | "cluster" | "all";
}

export async function POST(
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

    // Check if user has download permission
    const group = await Group.findOne({
      _id: groupId,
      members: {
        $elemMatch: {
          userId: user._id,
          "permissions.canDownload": true,
        },
      },
    });

    if (!group) {
      return Response.json(
        {
          success: false,
          error: "Group not found or download not permitted",
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    const body: DownloadRequestBody = await request.json();
    const { mediaIds, clusterId, downloadType } = body;

    let mediaItems;
    let zipName = `${group.name}_photos`;

    switch (downloadType) {
      case "selected":
        if (!mediaIds || mediaIds.length === 0) {
          return Response.json(
            {
              success: false,
              error: "No media selected",
            } satisfies ApiResponse,
            { status: 400 }
          );
        }

        mediaItems = await Media.find({
          _id: { $in: mediaIds },
          groupId,
        }).populate("uploaderId", "name email");

        zipName = `${group.name}_selected_photos`;
        break;

      case "cluster":
        if (!clusterId) {
          return Response.json(
            {
              success: false,
              error: "No cluster specified",
            } satisfies ApiResponse,
            { status: 400 }
          );
        }

        // Get cluster info
        const cluster = await FaceCluster.findById(clusterId);
        if (!cluster) {
          return Response.json(
            {
              success: false,
              error: "Cluster not found",
            } satisfies ApiResponse,
            { status: 404 }
          );
        }

        // Get all media for this cluster
        const clusterMembers = await FaceClusterMember.find({
          clusterId,
        }).populate("faceDetectionId");

        const faceDetectionIds = clusterMembers
          .map((member) => member.faceDetectionId)
          .filter(Boolean)
          .map((detection) => detection._id);

        const faceDetections = await FaceDetection.find({
          _id: { $in: faceDetectionIds },
        });

        const clusterMediaIds = [
          ...new Set(faceDetections.map((detection) => detection.mediaId)),
        ];

        mediaItems = await Media.find({
          _id: { $in: clusterMediaIds },
        }).populate("uploaderId", "name email");

        zipName = `${group.name}_${
          cluster.clusterName || "unknown_person"
        }_photos`;
        break;

      case "all":
        mediaItems = await Media.find({ groupId }).populate(
          "uploaderId",
          "name email"
        );

        zipName = `${group.name}_all_photos`;
        break;

      default:
        return Response.json(
          {
            success: false,
            error: "Invalid download type",
          } satisfies ApiResponse,
          { status: 400 }
        );
    }

    if (mediaItems.length === 0) {
      return Response.json(
        {
          success: false,
          error: "No media found to download",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // Prepare download items
    const downloadItems = mediaItems.map((item) => ({
      filename: item.originalName || item.filename,
      url: item.url, // Use S3 URL
      clusterId: clusterId,
      clusterName: clusterId ? zipName : undefined,
    }));

    // Create zip stream
    const { promise: zipBuffer } = await DownloadService.createZipStream(
      downloadItems
    );

    const buffer = await zipBuffer;

    // Return the zip file
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}.zip"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return Response.json(
      { success: false, error: "Download failed" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
