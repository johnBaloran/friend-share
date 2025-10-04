import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { MemberService } from "@/lib/services/memberService";
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
    const members = await MemberService.getGroupMembers(groupId);

    return Response.json({
      success: true,
      data: members,
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Get members error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch members",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
