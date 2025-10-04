import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { GroupService } from "@/lib/services/groupService";
import { z } from "zod";

const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name too long"),
  description: z.string().max(500, "Description too long").optional(),
  autoDeleteDays: z.number().min(1).max(365).default(30),
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
    const validatedData = createGroupSchema.parse(body);

    const group = await GroupService.createGroup(
      validatedData.name,
      user._id,
      validatedData.description,
      validatedData.autoDeleteDays
    );

    return Response.json(
      {
        success: true,
        data: group,
        message: "Group created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create group error:", error);

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
        error:
          error instanceof Error ? error.message : "Failed to create group",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
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
    const groups = await GroupService.getUserGroups(user._id);

    return Response.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    console.error("Get groups error:", error);

    return Response.json(
      {
        success: false,
        error: "Failed to fetch groups",
      },
      { status: 500 }
    );
  }
}
