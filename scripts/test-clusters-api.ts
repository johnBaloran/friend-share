import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import mongoose from "mongoose";
import { Group } from "../lib/models/Group";
import { FaceCluster } from "../lib/models/FaceCluster";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  console.log("📄 Loading environment from .env.local\n");
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log("📄 Loading environment from .env\n");
  dotenv.config({ path: envPath });
}

async function testClustersAPI() {
  try {
    console.log("🧪 Testing Clusters API Response...\n");

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get first group
    const groups = await Group.find().select("_id name");
    if (groups.length === 0) {
      console.log("⚠️  No groups found");
      await mongoose.disconnect();
      process.exit(0);
    }

    const groupId = groups[0]._id;
    console.log(`Testing with group: ${groups[0].name} (${groupId})\n`);

    // Simulate the API aggregation query
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
          samplePhoto: {
            $let: {
              vars: {
                firstFace: { $arrayElemAt: ["$faceDetections", 0] },
                firstMedia: { $arrayElemAt: ["$mediaItems", 0] },
              },
              in: {
                s3Key: "$$firstMedia.s3Key",
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

    console.log(`📊 Found ${clusters.length} clusters\n`);

    if (clusters.length === 0) {
      console.log("⚠️  No clusters returned from aggregation");
      await mongoose.disconnect();
      process.exit(0);
    }

    // Generate presigned URLs
    console.log("🔐 Generating presigned URLs...\n");

    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const clustersWithPresignedUrls = await Promise.all(
      clusters.map(async (cluster) => {
        if (cluster.samplePhoto?.s3Key) {
          try {
            const command = new GetObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Key: cluster.samplePhoto.s3Key,
            });
            const presignedUrl = await getSignedUrl(s3Client, command, {
              expiresIn: 3600,
            });
            return {
              ...cluster,
              samplePhoto: {
                ...cluster.samplePhoto,
                cloudinaryUrl: presignedUrl,
                url: presignedUrl,
              },
            };
          } catch (error) {
            console.error(`❌ Failed to generate URL for cluster ${cluster._id}:`, error);
            return cluster;
          }
        }
        return cluster;
      })
    );

    console.log("✅ API Response Preview:\n");
    console.log(`Total clusters: ${clustersWithPresignedUrls.length}`);
    console.log(`\nFirst cluster details:`);
    const first = clustersWithPresignedUrls[0];
    console.log(`  ID: ${first._id}`);
    console.log(`  Name: ${first.clusterName || "Unnamed"}`);
    console.log(`  Appearances: ${first.appearanceCount}`);
    console.log(`  Confidence: ${Math.round(first.confidence * 100)}%`);
    console.log(`  Total Photos: ${first.totalPhotos}`);
    console.log(`  Has sample photo: ${!!first.samplePhoto}`);
    if (first.samplePhoto) {
      console.log(`  S3 Key: ${first.samplePhoto.s3Key}`);
      console.log(
        `  Presigned URL: ${first.samplePhoto.cloudinaryUrl?.substring(0, 100)}...`
      );
      console.log(`  Bounding box: ${JSON.stringify(first.samplePhoto.boundingBox)}`);
    }

    console.log(`\n📝 Full API response structure:\n`);
    console.log(
      JSON.stringify(
        {
          success: true,
          data: clustersWithPresignedUrls,
        },
        null,
        2
      ).substring(0, 1000)
    );
    console.log("...\n");

    await mongoose.disconnect();
    console.log("✅ Test complete");
  } catch (error) {
    console.error("\n❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testClustersAPI();
