import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { QueueManager } from "@/lib/queues/manager";
import connectDB from "@/lib/config/database";
import type { ApiResponse, IJobStatus } from "@/lib/types";

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

    const jobs = await QueueManager.getGroupJobs(groupId);

    return Response.json({
      success: true,
      data: jobs,
    } satisfies ApiResponse<IJobStatus[]>);
  } catch (error) {
    console.error("Get group jobs error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch group jobs",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
