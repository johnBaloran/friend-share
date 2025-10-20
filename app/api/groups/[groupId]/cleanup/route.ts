import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { getStorageAnalytics, performCleanup } from "@/lib/services/storageService";
import { QueueManager } from "@/lib/queues/manager";
import connectDB from "@/lib/config/database";
import { z } from "zod";
import type { ApiResponse } from "@/lib/types";

const cleanupRequestSchema = z.object({
  deleteOlderThan: z.string().datetime().optional(),
  deleteLargerThan: z.number().positive().optional(),
  deleteUnprocessed: z.boolean().optional(),
  deleteDuplicates: z.boolean().optional(),
  mediaIds: z.array(z.string()).optional(),
});

export async function POST(
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

    const body = await request.json();
    const validatedData = cleanupRequestSchema.parse(body);

    // Convert string date to Date object if provided
    const cleanupOptions = {
      ...validatedData,
      deleteOlderThan: validatedData.deleteOlderThan
        ? new Date(validatedData.deleteOlderThan)
        : undefined,
    };

    // For large cleanups, queue a background job
    const estimatedFiles = await getStorageAnalytics(groupId);

    if (estimatedFiles.mediaByType.images > 100) {
      // Queue cleanup job for large operations
      const jobId = await QueueManager.addCleanupJob({
        groupId,
        userId: user._id,
        targetDate: cleanupOptions.deleteOlderThan || new Date(),
        mediaIds: cleanupOptions.mediaIds,
        metadata: cleanupOptions,
      });

      return Response.json({
        success: true,
        data: { jobId },
        message: "Cleanup job queued for processing",
      } satisfies ApiResponse);
    } else {
      // Process immediately for small operations
      const result = await performCleanup(
        groupId,
        cleanupOptions
      );

      return Response.json({
        success: true,
        data: result,
        message: `Deleted ${result.deletedCount} files, freed ${Math.round(
          result.freedSpace / 1024 / 1024
        )} MB`,
      } satisfies ApiResponse);
    }
  } catch (error) {
    console.error("Cleanup error:", error);

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
      { success: false, error: "Cleanup failed" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
