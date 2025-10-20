import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { FaceDetection } from "@/lib/models/FaceDetection";
import { FaceCluster } from "@/lib/models/FaceCluster";
import { FaceClusterMember } from "@/lib/models/FaceClusterMember";
import { clusterFaces } from "@/lib/services/faceClustering";
import connectDB from "@/lib/config/database";
import type { ApiResponse } from "@/lib/types";
import mongoose from "mongoose";

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

  const { groupId } = await params;

  try {
    await connectDB();

    // Check if user is admin/owner of group
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

    // Get collection ID
    const collectionId = `face-media-group-${groupId}`;

    // Get all face detections for this group
    const faceDetections = await FaceDetection.find({
      mediaId: {
        $in: await mongoose.connection.db
          .collection("media")
          .find({ groupId: new mongoose.Types.ObjectId(groupId) })
          .project({ _id: 1 })
          .toArray()
          .then((docs) => docs.map((doc) => doc._id)),
      },
      processed: true,
    });

    if (faceDetections.length === 0) {
      return Response.json(
        {
          success: false,
          error: "No faces found to cluster",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    console.log(
      `Re-clustering ${faceDetections.length} faces for group ${groupId}`
    );

    // Delete existing clusters and members
    const existingClusters = await FaceCluster.find({
      groupId: new mongoose.Types.ObjectId(groupId),
    });
    await FaceClusterMember.deleteMany({
      clusterId: { $in: existingClusters.map((c) => c._id) },
    });
    await FaceCluster.deleteMany({
      groupId: new mongoose.Types.ObjectId(groupId),
    });

    // Re-cluster with aggressive algorithm
    const rekognitionFaceIds = faceDetections.map((fd) => fd.rekognitionFaceId);
    const clusteringResult = await clusterFaces(
      collectionId,
      rekognitionFaceIds,
      85 // Aggressive threshold (75%) for better grouping
    );

    // Create new clusters
    const createdClusters = [];
    for (const cluster of clusteringResult.clusters) {
      const newCluster = await FaceCluster.create({
        groupId: new mongoose.Types.ObjectId(groupId),
        appearanceCount: cluster.size,
        confidence: cluster.averageSimilarity / 100,
      });

      // Create cluster members
      for (const faceId of cluster.faceIds) {
        const faceDetection = faceDetections.find(
          (fd) => fd.rekognitionFaceId === faceId
        );
        if (faceDetection) {
          await FaceClusterMember.create({
            clusterId: newCluster._id,
            faceDetectionId: faceDetection._id,
            confidence: 1.0,
          });
        }
      }

      createdClusters.push(newCluster);
    }

    // Handle unclustered faces (single appearances)
    for (const faceId of clusteringResult.unclusteredFaces) {
      const faceDetection = faceDetections.find(
        (fd) => fd.rekognitionFaceId === faceId
      );
      if (faceDetection) {
        const singleCluster = await FaceCluster.create({
          groupId: new mongoose.Types.ObjectId(groupId),
          appearanceCount: 1,
          confidence: 0.5,
        });

        await FaceClusterMember.create({
          clusterId: singleCluster._id,
          faceDetectionId: faceDetection._id,
          confidence: 1.0,
        });

        createdClusters.push(singleCluster);
      }
    }

    console.log(
      `Re-clustering complete: ${createdClusters.length} clusters created`
    );

    return Response.json({
      success: true,
      data: {
        totalClusters: createdClusters.length,
        totalFaces: faceDetections.length,
        message: "Faces re-clustered successfully",
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Re-clustering error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to re-cluster faces",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
