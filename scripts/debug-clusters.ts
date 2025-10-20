import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import mongoose from "mongoose";
import { FaceCluster } from "../lib/models/FaceCluster";
import { FaceClusterMember } from "../lib/models/FaceClusterMember";
import { FaceDetection } from "../lib/models/FaceDetection";
import { Media } from "../lib/models/Media";
import { Group } from "../lib/models/Group";

// Load environment variables from .env.local first, then .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  console.log("📄 Loading environment from .env.local\n");
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log("📄 Loading environment from .env\n");
  dotenv.config({ path: envPath });
}

async function debugClusters() {
  try {
    console.log("🔍 Debugging Face Clusters...\n");

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found in environment variables");
      process.exit(1);
    }

    console.log("📡 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get all groups
    console.log("📊 Fetching groups...");
    const groups = await Group.find().select("name _id");
    console.log(`Found ${groups.length} groups:\n`);
    groups.forEach((group) => {
      console.log(`  - ${group.name} (ID: ${group._id})`);
    });

    if (groups.length === 0) {
      console.log("\n⚠️  No groups found. Create a group first.");
      await mongoose.disconnect();
      process.exit(0);
    }

    // Use the first group for debugging
    const groupId = groups[0]._id;
    console.log(`\n🔍 Debugging group: ${groups[0].name}\n`);

    // Get all media for this group
    const media = await Media.find({ groupId }).select(
      "filename url s3Key processed"
    );
    console.log(`📸 Media items: ${media.length}`);
    media.forEach((m) => {
      console.log(`  - ${m.filename}`);
      console.log(`    URL: ${m.url}`);
      console.log(`    S3 Key: ${m.s3Key}`);
      console.log(`    Processed: ${m.processed}`);
    });

    // Get all face detections
    const faceDetections = await FaceDetection.find({
      mediaId: { $in: media.map((m) => m._id) },
    }).populate("mediaId");
    console.log(`\n👤 Face detections: ${faceDetections.length}`);

    // Get all clusters
    const clusters = await FaceCluster.find({ groupId });
    console.log(`\n🎯 Face clusters: ${clusters.length}`);

    if (clusters.length === 0) {
      console.log("\n⚠️  No clusters found!");
      console.log("This could mean:");
      console.log("  1. Face grouping job hasn't completed yet");
      console.log("  2. Worker failed to create clusters");
      console.log("  3. No faces were detected in the photos");
      console.log("\nCheck worker logs for errors.");
    } else {
      console.log("\nCluster Details:");
      for (const cluster of clusters) {
        console.log(`\n  Cluster ID: ${cluster._id}`);
        console.log(`  Name: ${cluster.clusterName || "Unnamed"}`);
        console.log(`  Appearances: ${cluster.appearanceCount}`);
        console.log(`  Confidence: ${Math.round(cluster.confidence * 100)}%`);

        // Get cluster members
        const members = await FaceClusterMember.find({
          clusterId: cluster._id,
        }).populate("faceDetectionId");
        console.log(`  Members: ${members.length}`);

        // Get sample face detection
        if (members.length > 0) {
          const firstMember = members[0];
          const faceDetection = await FaceDetection.findById(
            firstMember.faceDetectionId
          );
          if (faceDetection) {
            const mediaItem = await Media.findById(faceDetection.mediaId);
            console.log(`  Sample photo: ${mediaItem?.filename || "N/A"}`);
            console.log(`  Sample URL: ${mediaItem?.url || "N/A"}`);
            console.log(
              `  Bounding box: ${JSON.stringify(faceDetection.boundingBox)}`
            );
          }
        }
      }
    }

    // Test the aggregation query used by the API
    console.log("\n\n🧪 Testing API aggregation query...\n");
    const aggregationResult = await FaceCluster.aggregate([
      { $match: { groupId: groupId } },
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
          samplePhoto: {
            $let: {
              vars: {
                firstFace: { $arrayElemAt: ["$faceDetections", 0] },
                firstMedia: { $arrayElemAt: ["$mediaItems", 0] },
              },
              in: {
                cloudinaryUrl: "$$firstMedia.url",
                url: "$$firstMedia.url",
                boundingBox: "$$firstFace.boundingBox",
              },
            },
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

    console.log("Aggregation Result:");
    console.log(JSON.stringify(aggregationResult, null, 2));

    await mongoose.disconnect();
    console.log("\n✅ Debugging complete");
  } catch (error) {
    console.error("\n❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

debugClusters();
