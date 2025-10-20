import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { Media } from "@/lib/models/Media";
import { uploadMedia } from "@/lib/services/s3";
import { createCollection } from "@/lib/services/rekognition";
import { faceDetectionQueue } from "@/lib/queues/index";
import { ActivityService } from "@/lib/services/activityService";
import connectDB from "@/lib/config/database";
import { config } from "@/lib/config/env";
import type { ApiResponse } from "@/lib/types";

export async function POST(
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

    // Check if user can upload to this group
    const group = await Group.findOne({
      _id: groupId,
      members: {
        $elemMatch: {
          userId: user._id,
          "permissions.canUpload": true,
        },
      },
    });

    if (!group) {
      return Response.json(
        {
          success: false,
          error: "Group not found or upload not permitted",
        } satisfies ApiResponse,
        { status: 403 }
      );
    }

    // Ensure Rekognition collection exists
    let collectionId = group.rekognitionCollectionId;
    if (!collectionId) {
      collectionId = await createCollection(groupId);
      await Group.findByIdAndUpdate(groupId, {
        rekognitionCollectionId: collectionId,
      });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return Response.json(
        { success: false, error: "No files provided" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (files.length > config.MAX_FILES_PER_UPLOAD) {
      return Response.json(
        {
          success: false,
          error: `Too many files. Maximum ${config.MAX_FILES_PER_UPLOAD} allowed`,
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Validate files
    const validatedFiles = files.filter((file) => {
      const isValidType = file.type.startsWith("image/");
      const isValidSize = file.size <= config.MAX_FILE_SIZE;
      return isValidType && isValidSize;
    });

    if (validatedFiles.length === 0) {
      return Response.json(
        {
          success: false,
          error: "No valid image files found",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Check storage limit
    const totalSize = validatedFiles.reduce((sum, file) => sum + file.size, 0);

    if (group.storageUsed + totalSize > group.storageLimit) {
      return Response.json(
        {
          success: false,
          error: "Storage limit exceeded",
        } satisfies ApiResponse,
        { status: 413 }
      );
    }

    // Upload to S3 and save to database
    const uploadPromises = validatedFiles.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Upload to S3
      const s3Result = await uploadMedia(
        buffer,
        file.name,
        groupId,
        file.type
      );

      // Create Media document
      return await Media.create({
        groupId,
        uploaderId: user._id,
        filename: file.name,
        originalName: file.name,
        s3Key: s3Result.key,
        s3Bucket: s3Result.bucket,
        url: s3Result.url,
        fileSize: file.size,
        mimeType: file.type,
        processed: false,
      });
    });

    const uploadResults = await Promise.all(uploadPromises);
    const mediaIds = uploadResults.map((result) => result._id.toString());

    // Update group storage usage
    await Group.findByIdAndUpdate(groupId, {
      $inc: { storageUsed: totalSize },
    });

    // Record upload activity
    await ActivityService.recordUploadActivity(
      user._id,
      groupId,
      validatedFiles.length
    );

    // Queue face detection job (background processing)
    let jobId: string | undefined;
    try {
      const job = await faceDetectionQueue.add("detect-faces", {
        groupId,
        userId: user._id,
        mediaIds,
        metadata: {
          uploadBatch: new Date().toISOString(),
          fileCount: validatedFiles.length,
        },
      });
      jobId = job.id;

      console.log(
        `Queued face detection job ${jobId} for ${validatedFiles.length} images`
      );
    } catch (queueError) {
      console.error("Failed to queue face detection job:", queueError);
      // Continue without queueing - faces can be processed later
    }

    return Response.json({
      success: true,
      data: {
        uploadedCount: validatedFiles.length,
        totalSize,
        mediaIds,
        jobId, // Return job ID for progress tracking
      },
      message: `Successfully uploaded ${validatedFiles.length} file${
        validatedFiles.length > 1 ? "s" : ""
      }. Face detection ${jobId ? "started" : "queued for later processing"}.`,
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
