import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { getStorageAnalytics } from "@/lib/services/storageService";
import connectDB from "@/lib/config/database";
import type { ApiResponse } from "@/lib/types";

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

    // Check if user is admin of the group
    const group = await Group.findOne({
      _id: groupId,
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

    const analytics = await getStorageAnalytics(groupId);

    return Response.json({
      success: true,
      data: analytics,
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Storage analytics error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch storage analytics",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
