import dotenv from "dotenv";
import path from "path";

// Load environment variables FIRST
const envPath = path.resolve(process.cwd(), ".env.local");
dotenv.config({ path: envPath });

import { FaceDetection } from "@/lib/models/FaceDetection";
import { Media } from "@/lib/models/Media";
import connectDB from "@/lib/config/database";
import { indexFaces, calculateFaceQualityScore } from "@/lib/services/rekognition";
import { config } from "@/lib/config/env";

/**
 * Backfill quality scores for existing face detections
 * This re-indexes faces to get quality data from AWS Rekognition
 */
async function backfillQualityScores() {
  try {
    await connectDB();

    console.log("🔍 Finding face detections without quality scores...");

    // Find all face detections without quality scores
    const faceDetectionsWithoutQuality = await FaceDetection.find({
      qualityScore: { $exists: false },
    })
      .limit(100) // Process in batches
      .populate("mediaId");

    if (faceDetectionsWithoutQuality.length === 0) {
      console.log("✅ All face detections already have quality scores!");
      return;
    }

    console.log(
      `📊 Found ${faceDetectionsWithoutQuality.length} face detections to update`
    );

    // Group by media to avoid re-indexing same image multiple times
    const mediaMap = new Map<string, any[]>();

    for (const faceDetection of faceDetectionsWithoutQuality) {
      const mediaId = faceDetection.mediaId._id.toString();
      if (!mediaMap.has(mediaId)) {
        mediaMap.set(mediaId, []);
      }
      mediaMap.get(mediaId)!.push(faceDetection);
    }

    console.log(`🖼️  Processing ${mediaMap.size} unique images...`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const [mediaId, faceDetections] of mediaMap.entries()) {
      try {
        const media = faceDetections[0].mediaId;

        console.log(`\n📷 Processing: ${media.filename}`);
        console.log(`   S3: ${media.s3Key}`);
        console.log(`   Faces: ${faceDetections.length}`);

        // Get group's collection ID
        const groupId = media.groupId.toString();
        const collectionId = `face-media-group-${groupId}`;

        // Re-index faces to get fresh quality data
        const indexedFaces = await indexFaces(
          collectionId,
          media.s3Bucket,
          media.s3Key,
          media._id.toString()
        );

        console.log(`   ✅ Re-indexed ${indexedFaces.length} faces`);

        // Match indexed faces to existing face detections by rekognitionFaceId
        for (const indexedFace of indexedFaces) {
          const existingFace = faceDetections.find(
            (fd) => fd.rekognitionFaceId === indexedFace.faceId
          );

          if (existingFace) {
            const qualityScore = calculateFaceQualityScore(indexedFace);

            await FaceDetection.findByIdAndUpdate(existingFace._id, {
              quality: indexedFace.quality,
              pose: indexedFace.pose,
              qualityScore: qualityScore,
            });

            console.log(
              `      Face ${existingFace.rekognitionFaceId.substring(0, 8)}... → Quality: ${qualityScore}`
            );
            updatedCount++;
          }
        }

        // Rate limiting - wait between images
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`   ❌ Error processing media ${mediaId}:`, error);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Backfill Summary:");
    console.log(`   ✅ Updated: ${updatedCount} face detections`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log("=".repeat(60));

    if (faceDetectionsWithoutQuality.length >= 100) {
      console.log(
        "\n⚠️  Note: Processed 100 faces. Run again to process more."
      );
    }
  } catch (error) {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

backfillQualityScores();
