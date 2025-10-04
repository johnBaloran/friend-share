import { Media } from "@/lib/models/Media";
import { FaceDetection } from "@/lib/models/FaceDetection";
import { FaceCluster } from "@/lib/models/FaceCluster";
import { FaceClusterMember } from "@/lib/models/FaceClusterMember";
import { AzureFaceService } from "@/lib/services/azureFace";
import connectDB from "@/lib/config/database";

const azureFaceService = new AzureFaceService();

export class FaceProcessingService {
  static async processMediaBatch(
    mediaIds: string[],
    groupId: string
  ): Promise<{
    facesDetected: number;
    clustersCreated: number;
  }> {
    await connectDB();

    // Get media URLs
    const mediaItems = await Media.find({
      _id: { $in: mediaIds },
      groupId,
    }).select("_id cloudinaryUrl filename");

    if (mediaItems.length === 0) {
      return { facesDetected: 0, clustersCreated: 0 };
    }

    // Create URL to ID mapping
    const urlToIdMap = new Map<string, string>();
    const imageUrls: string[] = [];

    mediaItems.forEach((item) => {
      urlToIdMap.set(item.cloudinaryUrl, item._id.toString());
      imageUrls.push(item.cloudinaryUrl);
    });

    // Detect faces
    const detectionResults = await azureFaceService.detectFaces(imageUrls);

    const allFaceDetectionIds: string[] = [];

    // Store face detections
    for (const [url, faces] of detectionResults.entries()) {
      const mediaId = urlToIdMap.get(url);
      if (!mediaId) continue;

      const faceDetectionPromises = faces.map(async (face) => {
        const faceDetection = await FaceDetection.create({
          mediaId,
          azureFaceId: face.faceId,
          boundingBox: face.boundingBox,
          confidence: face.confidence,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        return faceDetection._id.toString();
      });

      const createdFaceIds = await Promise.all(faceDetectionPromises);
      allFaceDetectionIds.push(...createdFaceIds);

      // Mark media as processed
      await Media.findByIdAndUpdate(mediaId, { processed: true });
    }

    // Group faces if we have any
    let clustersCreated = 0;
    if (allFaceDetectionIds.length > 0) {
      clustersCreated = await this.groupFaces(allFaceDetectionIds, groupId);
    }

    return {
      facesDetected: allFaceDetectionIds.length,
      clustersCreated,
    };
  }

  private static async groupFaces(
    faceDetectionIds: string[],
    groupId: string
  ): Promise<number> {
    const faceDetections = await FaceDetection.find({
      _id: { $in: faceDetectionIds },
      expiresAt: { $gt: new Date() },
      processed: false,
    }).select("_id azureFaceId");

    if (faceDetections.length === 0) return 0;

    const faceIds = faceDetections.map((f) => f.azureFaceId);
    const faceIdToDetectionId = new Map<string, string>();

    faceDetections.forEach((f) => {
      faceIdToDetectionId.set(f.azureFaceId, f._id.toString());
    });

    // Group faces
    const groupingResults = await azureFaceService.groupFaces(faceIds);

    let clustersCreated = 0;

    // Create clusters for grouped faces
    for (const group of groupingResults.groups) {
      if (group.length < 2) continue;

      const cluster = await FaceCluster.create({
        groupId,
        appearanceCount: group.length,
        confidence: 0.8,
      });

      const clusterMemberPromises = group
        .map((faceId) => faceIdToDetectionId.get(faceId))
        .filter((detectionId): detectionId is string => Boolean(detectionId))
        .map((detectionId) =>
          FaceClusterMember.create({
            clusterId: cluster._id,
            faceDetectionId: detectionId,
            confidence: 0.8,
          })
        );

      await Promise.all(clusterMemberPromises);
      clustersCreated++;
    }

    // Handle messy group (uncertain faces)
    for (const faceId of groupingResults.messyGroup) {
      const detectionId = faceIdToDetectionId.get(faceId);
      if (!detectionId) continue;

      const cluster = await FaceCluster.create({
        groupId,
        appearanceCount: 1,
        confidence: 0.5,
      });

      await FaceClusterMember.create({
        clusterId: cluster._id,
        faceDetectionId: detectionId,
        confidence: 0.5,
      });

      clustersCreated++;
    }

    // Mark face detections as processed
    await FaceDetection.updateMany(
      { _id: { $in: faceDetectionIds } },
      { processed: true }
    );

    return clustersCreated;
  }
}
