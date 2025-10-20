import { NextRequest, NextResponse } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { getObjectBuffer } from "@/lib/services/s3";

/**
 * Proxy endpoint to serve S3 images with proper CORS headers
 * This bypasses CORS issues when loading images in Canvas
 */
export async function GET(request: NextRequest) {
  const authResult = await createAuthMiddleware(true)();

  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const s3Key = searchParams.get("key");

    if (!s3Key) {
      return NextResponse.json(
        { success: false, error: "Missing S3 key" },
        { status: 400 }
      );
    }

    // Get the image buffer from S3
    const buffer = await getObjectBuffer(s3Key);

    // Determine content type based on file extension
    const ext = s3Key.split(".").pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    const contentType = contentTypeMap[ext || ""] || "image/jpeg";

    // Return the image with proper CORS headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch media",
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
