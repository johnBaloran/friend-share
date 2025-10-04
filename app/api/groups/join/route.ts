import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { GroupService } from "@/lib/services/groupService";
import { z } from "zod";

const joinGroupSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
});

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const { inviteCode } = joinGroupSchema.parse(body);

    const group = await GroupService.joinGroup(inviteCode, user._id);

    return Response.json({
      success: true,
      data: group,
      message: "Successfully joined group",
    });
  } catch (error) {
    console.error("Join group error:", error);

    if (error instanceof z.ZodError) {
      return Response.json(
        {
          success: false,
          error: "Validation failed",
          details: error.issues, // Changed from error.errors to error.issues
        },
        { status: 400 }
      );
    }

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to join group",
      },
      { status: 400 }
    );
  }
}
