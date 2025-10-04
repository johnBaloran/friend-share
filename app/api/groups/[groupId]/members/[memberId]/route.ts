import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { MemberService } from "@/lib/services/memberService";
import { z } from "zod";
import type { ApiResponse } from "@/lib/types";

const updateMemberSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).optional(),
  permissions: z
    .object({
      canUpload: z.boolean(),
      canDownload: z.boolean(),
      canDelete: z.boolean(),
    })
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { groupId: string; memberId: string } }
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

  const { groupId, memberId } = params;

  try {
    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    if (validatedData.role) {
      await MemberService.updateMemberRole(
        groupId,
        memberId,
        validatedData.role,
        user._id
      );
    }

    if (validatedData.permissions) {
      await MemberService.updateMemberPermissions(
        groupId,
        memberId,
        validatedData.permissions,
        user._id
      );
    }

    return Response.json({
      success: true,
      message: "Member updated successfully",
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Update member error:", error);

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
        error:
          error instanceof Error ? error.message : "Failed to update member",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string; memberId: string } }
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

  const { groupId, memberId } = params;

  try {
    await MemberService.removeMember(groupId, memberId, user._id);

    return Response.json({
      success: true,
      message: "Member removed successfully",
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Remove member error:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to remove member",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
