import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import connectDB from "@/lib/config/database";

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

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": user._id,
    }).populate("members.userId", "name email");

    if (!group) {
      return Response.json(
        { success: false, error: "Group not found or access denied" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error("Get group error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch group" },
      { status: 500 }
    );
  }
}
