import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { FaceCluster } from "@/lib/models/FaceCluster";
import { FaceClusterMember } from "@/lib/models/FaceClusterMember";
import connectDB from "@/lib/config/database";
import { z } from "zod";
import type { ApiResponse } from "@/lib/types";

const updateClusterSchema = z.object({
  clusterName: z.string().max(50).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { clusterId: string } }
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

  const clusterId = params.clusterId;

  try {
    await connectDB();

    const body = await request.json();
    const validatedData = updateClusterSchema.parse(body);

    // Find the cluster and verify user has access to the group
    const cluster = await FaceCluster.findById(clusterId);

    if (!cluster) {
      return Response.json(
        { success: false, error: "Cluster not found" } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // Check if user is member of the group
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

    // Update cluster
    const updatedCluster = await FaceCluster.findByIdAndUpdate(
      clusterId,
      validatedData,
      { new: true }
    );

    return Response.json({
      success: true,
      data: updatedCluster,
      message: "Cluster updated successfully",
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Update cluster error:", error);

    if (error instanceof z.ZodError) {
      return Response.json(
        {
          success: false,
          error: "Validation failed",
          details: error.issues,
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    return Response.json(
      {
        success: false,
        error: "Failed to update cluster",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { clusterId: string } }
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

  const clusterId = params.clusterId;

  try {
    await connectDB();

    // Find the cluster and verify user has access
    const cluster = await FaceCluster.findById(clusterId);

    if (!cluster) {
      return Response.json(
        { success: false, error: "Cluster not found" } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // Check if user is admin of the group
    const group = await Group.findOne({
      _id: cluster.groupId,
      members: {
        $elemMatch: {
          userId: user._id,
          role: "ADMIN",
        },
      },
    });

    if (!group) {
      return Response.json(
        {
          success: false,
          error: "Admin access required",
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    // Delete cluster members first
    await FaceClusterMember.deleteMany({ clusterId });

    // Delete the cluster
    await FaceCluster.findByIdAndDelete(clusterId);

    return Response.json({
      success: true,
      message: "Cluster deleted successfully",
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Delete cluster error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to delete cluster",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
