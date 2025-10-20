import { NextRequest } from "next/server";
import { createAuthMiddleware } from "@/lib/middleware/clerkAuth";
import { Group } from "@/lib/models/Group";
import { FaceCluster } from "@/lib/models/FaceCluster";
import { getPresignedUrl } from "@/lib/services/s3";
import { Media } from "@/lib/models/Media";
import mongoose from "mongoose";

import connectDB from "@/lib/config/database";
import type { ApiResponse } from "@/lib/types";

interface ClusterWithSample {
  _id: string;
  clusterName?: string;
  appearanceCount: number;
  confidence: number;
  createdAt: Date;
  samplePhoto?: {
    cloudinaryUrl: string;
    url: string;
    s3Key?: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  totalPhotos: number;
}

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
    await connectDB();

    // Check if user is member of group
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

    // Get face clusters with sample photos
    const clusters = await FaceCluster.aggregate([
      { $match: { groupId: new mongoose.Types.ObjectId(groupId) } },
      {
        $lookup: {
          from: "faceclustermembers",
          localField: "_id",
          foreignField: "clusterId",
          as: "members",
        },
      },
      {
        $lookup: {
          from: "facedetections",
          localField: "members.faceDetectionId",
          foreignField: "_id",
          as: "faceDetections",
        },
      },
      {
        $lookup: {
          from: "media",
          localField: "faceDetections.mediaId",
          foreignField: "_id",
          as: "mediaItems",
        },
      },
      {
        $addFields: {
          totalPhotos: { $size: "$mediaItems" },
          // Select best quality face (or first if no quality scores exist)
          maxQuality: { $max: "$faceDetections.qualityScore" },
          bestFace: {
            $cond: {
              if: { $gt: [{ $max: "$faceDetections.qualityScore" }, 0] },
              then: {
                // Use best quality face if quality scores exist
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$faceDetections",
                      as: "face",
                      cond: {
                        $eq: [
                          "$$face.qualityScore",
                          { $max: "$faceDetections.qualityScore" }
                        ]
                      }
                    }
                  },
                  0
                ]
              },
              else: {
                // Fallback to first face if no quality scores
                $arrayElemAt: ["$faceDetections", 0]
              }
            }
          },
        },
      },
      {
        $addFields: {
          // Find the media item that contains the best face
          bestMedia: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$mediaItems",
                  as: "media",
                  cond: {
                    $eq: [
                      "$$media._id",
                      "$bestFace.mediaId"
                    ]
                  }
                }
              },
              0
            ]
          },
        },
      },
      {
        $addFields: {
          samplePhoto: {
            $cond: {
              if: { $and: ["$bestMedia", "$bestFace"] },
              then: {
                s3Key: "$bestMedia.s3Key",
                boundingBox: "$bestFace.boundingBox",
              },
              else: null
            }
          },
        },
      },
      {
        $project: {
          _id: 1,
          clusterName: 1,
          appearanceCount: 1,
          confidence: 1,
          createdAt: 1,
          samplePhoto: 1,
          totalPhotos: 1,
        },
      },
      { $sort: { appearanceCount: -1, createdAt: -1 } },
    ]);

    // Generate presigned URLs for sample photos
    const clustersWithPresignedUrls = await Promise.all(
      clusters.map(async (cluster) => {
        if (cluster.samplePhoto?.s3Key) {
          try {
            const presignedUrl = await getPresignedUrl(
              cluster.samplePhoto.s3Key,
              3600 // 1 hour expiry
            );
            return {
              ...cluster,
              samplePhoto: {
                ...cluster.samplePhoto,
                cloudinaryUrl: presignedUrl, // Use presigned URL
                url: presignedUrl,
                s3Key: cluster.samplePhoto.s3Key, // Include s3Key for proxy fallback
              },
            };
          } catch (error) {
            console.error(
              `Failed to generate presigned URL for cluster ${cluster._id}:`,
              error
            );
            return cluster;
          }
        }
        return cluster;
      })
    );

    return Response.json({
      success: true,
      data: clustersWithPresignedUrls,
    } satisfies ApiResponse<ClusterWithSample[]>);
  } catch (error) {
    console.error("Get clusters error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch face clusters",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
