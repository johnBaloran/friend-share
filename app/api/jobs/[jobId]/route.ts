import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { QueueManager } from "@/lib/queues/manager";
import type { ApiResponse, IJobStatus } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
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

  const jobId = params.jobId;

  try {
    const jobStatus = await QueueManager.getJobStatus(jobId);

    if (!jobStatus) {
      return Response.json(
        { success: false, error: "Job not found" } satisfies ApiResponse,
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: jobStatus,
    } satisfies ApiResponse<IJobStatus>);
  } catch (error) {
    console.error("Get job status error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch job status",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
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

  const jobId = params.jobId;

  try {
    const cancelled = await QueueManager.cancelJob(jobId);

    if (!cancelled) {
      return Response.json(
        {
          success: false,
          error: "Job not found or cannot be cancelled",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "Job cancelled successfully",
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Cancel job error:", error);
    return Response.json(
      { success: false, error: "Failed to cancel job" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
