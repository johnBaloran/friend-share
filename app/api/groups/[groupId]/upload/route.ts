// import { NextRequest } from "next/server";
// import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
// import { CloudinaryService } from "@/lib/services/cloudinary";
// import { Media, IMedia } from "@/lib/models/Media";
// import { Group, IGroupMember } from "@/lib/models/Group";
// import { config } from "@/lib/config/env";
// import connectDB from "@/lib/config/database";
// // import { QueueManager } from "@/lib/queues/manager";
// import { FaceProcessingService } from "@/lib/services/faceProcessing";

// export async function POST(
//   request: NextRequest,
//   { params }: { params: Promise<{ groupId: string }> }
// ) {
//   const authResult = await createAuthMiddleware(true)();

//   if (authResult instanceof Response) {
//     return authResult;
//   }

//   const { user } = authResult;

//   if (!user) {
//     return Response.json(
//       { success: false, error: "Unauthorized" },
//       { status: 401 }
//     );
//   }

//   const { groupId } = await params; // Fixed

//   try {
//     await connectDB();

//     // Check if user is member of group
//     const group = await Group.findOne({
//       _id: groupId,
//       "members.userId": user._id,
//     });

//     if (!group) {
//       return Response.json(
//         { success: false, error: "Group not found or access denied" },
//         { status: 404 }
//       );
//     }

//     // Check upload permission with proper typing
//     const member = group.members.find(
//       (m: IGroupMember) => m.userId.toString() === user._id
//     );
//     if (!member?.permissions.canUpload) {
//       return Response.json(
//         { success: false, error: "No upload permission" },
//         { status: 403 }
//       );
//     }

//     const formData = await request.formData();
//     const files = formData.getAll("files") as File[];

//     if (files.length === 0) {
//       return Response.json(
//         { success: false, error: "No files uploaded" },
//         { status: 400 }
//       );
//     }

//     if (files.length > config.MAX_FILES_PER_UPLOAD) {
//       return Response.json(
//         {
//           success: false,
//           error: `Too many files. Maximum ${config.MAX_FILES_PER_UPLOAD} allowed`,
//         },
//         { status: 400 }
//       );
//     }

//     // Check storage limit
//     const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);

//     if (group.storageUsed + totalFileSize > group.storageLimit) {
//       return Response.json(
//         { success: false, error: "Storage limit exceeded" },
//         { status: 413 }
//       );
//     }

//     const uploadedMedia: IMedia[] = [];

//     // Process each file
//     for (const file of files) {
//       if (file.size > config.MAX_FILE_SIZE) {
//         continue; // Skip oversized files
//       }

//       // Validate file type
//       if (!file.type.startsWith("image/")) {
//         continue; // Skip non-image files
//       }

//       const buffer = Buffer.from(await file.arrayBuffer());

//       // Upload to Cloudinary
//       const cloudinaryResult = await CloudinaryService.uploadMedia(
//         buffer,
//         file.name,
//         groupId
//       );

//       // Save to database
//       const mediaRecord = await Media.create({
//         groupId,
//         uploaderId: user._id,
//         filename: cloudinaryResult.public_id,
//         originalName: file.name,
//         cloudinaryUrl: cloudinaryResult.secure_url,
//         publicId: cloudinaryResult.public_id,
//         mimeType: file.type,
//         fileSize: file.size,
//         width: cloudinaryResult.width,
//         height: cloudinaryResult.height,
//       });

//       uploadedMedia.push(mediaRecord);
//     }

//     // Update group storage usage
//     await Group.findByIdAndUpdate(groupId, {
//       $inc: { storageUsed: totalFileSize },
//     });

//     // Queue face detection job for uploaded media
//     // if (uploadedMedia.length > 0) {
//     //   try {
//     //     const jobId = await QueueManager.addFaceDetectionJob({
//     //       groupId,
//     //       userId: user._id,
//     //       mediaIds: uploadedMedia.map((m) => m._id.toString()),
//     //       metadata: {
//     //         uploadBatch: new Date().toISOString(),
//     //         fileCount: uploadedMedia.length,
//     //       },
//     //     });

//     //     return Response.json({
//     //       success: true,
//     //       data: {
//     //         uploaded: uploadedMedia.length,
//     //         mediaIds: uploadedMedia.map((m) => m._id),
//     //         totalSize: totalFileSize,
//     //         jobId, // Return job ID for tracking
//     //       },
//     //       message: `Successfully uploaded ${uploadedMedia.length} files. Face detection started.`,
//     //     });
//     //   } catch (jobError) {
//     //     console.error("Failed to queue face detection job:", jobError);

//     //     // Upload succeeded but job failed - still return success
//     //     return Response.json({
//     //       success: true,
//     //       data: {
//     //         uploaded: uploadedMedia.length,
//     //         mediaIds: uploadedMedia.map((m) => m._id),
//     //         totalSize: totalFileSize,
//     //       },
//     //       message: `Uploaded ${uploadedMedia.length} files. Face detection will be processed later.`,
//     //     });
//     //   }
//     // }

//     if (uploadedMedia.length > 0) {
//       try {
//         // Replace queue call with direct processing
//         const result = await FaceProcessingService.processMediaBatch(
//           uploadedMedia.map((m) => m._id.toString()),
//           groupId
//         );

//         return Response.json({
//           success: true,
//           data: {
//             uploaded: uploadedMedia.length,
//             mediaIds: uploadedMedia.map((m) => m._id),
//             totalSize: totalFileSize,
//             facesDetected: result.facesDetected,
//             clustersCreated: result.clustersCreated,
//           },
//           message: `Successfully uploaded ${uploadedMedia.length} files. Detected ${result.facesDetected} faces in ${result.clustersCreated} clusters.`,
//         });
//       } catch (processingError) {
//         console.error("Face processing failed:", processingError);

//         // Upload succeeded but face processing failed - still return success
//         return Response.json({
//           success: true,
//           data: {
//             uploaded: uploadedMedia.length,
//             mediaIds: uploadedMedia.map((m) => m._id),
//             totalSize: totalFileSize,
//           },
//           message: `Uploaded ${uploadedMedia.length} files. Face detection failed but can be retried.`,
//         });
//       }
//     }

//     return Response.json({
//       success: true,
//       data: {
//         uploaded: uploadedMedia.length,
//         mediaIds: uploadedMedia.map((m: IMedia) => m._id),
//         totalSize: totalFileSize,
//       },
//       message: `Successfully uploaded ${uploadedMedia.length} files`,
//     });
//   } catch (error) {
//     console.error("Upload error:", error);
//     return Response.json(
//       { success: false, error: "Upload failed" },
//       { status: 500 }
//     );
//   }
// }
import { v2 as cloudinary } from "cloudinary";
import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { Media } from "@/lib/models/Media";
import { FaceProcessingService } from "@/lib/services/faceProcessing";
import { ActivityService } from "@/lib/services/activityService";
import connectDB from "@/lib/config/database";
import type { ApiResponse } from "@/lib/types";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return Response.json(
        { success: false, error: "No files provided" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Validate files
    const validatedFiles = files.filter((file) => {
      const isValidType = file.type.startsWith("image/");
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
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

    // Upload to Cloudinary and save to database
    const uploadPromises = validatedFiles.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());

      const cloudinaryResult = await new Promise<{
        public_id: string;
        secure_url: string;
        bytes: number;
      }>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: "image",
              folder: `groups/${groupId}`,
            },
            (error, result) => {
              if (error) reject(error);
              else if (result) resolve(result);
              else reject(new Error("Upload failed"));
            }
          )
          .end(buffer);
      });

      // Create and return the Media document
      return await Media.create({
        groupId,
        uploaderId: user._id,
        filename: cloudinaryResult.public_id,
        originalName: file.name,
        cloudinaryUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        fileSize: file.size,
        mimeType: file.type,
        processed: false,
      });
    });

    const uploadResults = await Promise.all(uploadPromises);
    const mediaIds = uploadResults.map((result) => result._id.toString());

    // Update group storage usage
    const totalSize = validatedFiles.reduce((sum, file) => sum + file.size, 0);
    await Group.findByIdAndUpdate(groupId, {
      $inc: { storageUsed: totalSize },
    });

    // Record upload activity
    await ActivityService.recordUploadActivity(
      user._id,
      groupId,
      validatedFiles.length
    );

    console.log(
      `Starting face detection for ${
        validatedFiles.length
      } images. Estimated time: ${validatedFiles.length * 4} seconds`
    );

    // Process faces directly (this will take time but block the request)
    let faceProcessingResult = { facesDetected: 0, clustersCreated: 0 };

    try {
      faceProcessingResult = await FaceProcessingService.processMediaBatch(
        mediaIds,
        groupId
      );

      // Record face detection activity if faces were found
      if (faceProcessingResult.facesDetected > 0) {
        await ActivityService.recordFaceDetectionActivity(
          user._id,
          groupId,
          faceProcessingResult.facesDetected,
          faceProcessingResult.clustersCreated
        );
      }
    } catch (faceError) {
      console.error("Face processing failed:", faceError);
      // Continue without face processing - files are still uploaded
    }

    return Response.json({
      success: true,
      data: {
        uploadedCount: validatedFiles.length,
        totalSize,
        facesDetected: faceProcessingResult.facesDetected,
        clustersCreated: faceProcessingResult.clustersCreated,
        mediaIds,
      },
      message: `Successfully uploaded ${validatedFiles.length} file${
        validatedFiles.length > 1 ? "s" : ""
      }`,
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      { success: false, error: "Upload failed" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
