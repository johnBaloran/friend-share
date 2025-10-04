import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { ActivityService } from "@/lib/services/activityService";
import { z } from "zod";
import type { ApiResponse } from "@/lib/types";

const notificationPreferencesSchema = z.object({
  preferences: z.object({
    uploads: z.boolean().optional(),
    faceDetection: z.boolean().optional(),
    memberActivity: z.boolean().optional(),
    downloads: z.boolean().optional(),
    emailDigest: z.boolean().optional(),
  }),
  digestFrequency: z.enum(["DAILY", "WEEKLY", "NEVER"]).optional(),
});

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

    const preferences = await ActivityService.getUserNotificationPreferences(
      user._id,
      groupId
    );

    return Response.json({
      success: true,
      data: preferences,
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Get notification preferences error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch notification preferences",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const body = await request.json();
    const validatedData = notificationPreferencesSchema.parse(body);

    await ActivityService.updateNotificationPreferences(
      user._id,
      groupId,
      validatedData.preferences,
      validatedData.digestFrequency
    );

    return Response.json({
      success: true,
      message: "Notification preferences updated successfully",
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Update notification preferences error:", error);

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
        error: "Failed to update notification preferences",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
