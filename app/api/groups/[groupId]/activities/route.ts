import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { ActivityService } from "@/lib/services/activityService";
import type { ApiResponse } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
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

  const { groupId } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    // Check if user has access to the group
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

    const result = await ActivityService.getGroupActivities(
      groupId,
      page,
      limit
    );

    return Response.json({
      success: true,
      data: result,
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Get activities error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch activities",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
