// import { FaceClient } from "@azure/cognitiveservices-face";
// import { ApiKeyCredentials } from "@azure/ms-rest-js";
// import { config } from "@/lib/config/env";
// import type {
//   AzureFaceDetectionResult,
//   AzureFaceGroupResult,
//   BoundingBox,
// } from "@/lib/types";

// export interface ProcessedFaceDetection {
//   faceId: string;
//   boundingBox: BoundingBox;
//   confidence: number;
// }

// export class AzureFaceService {
//   private client: FaceClient;

//   constructor() {
//     const credentials = new ApiKeyCredentials({
//       inHeader: { "Ocp-Apim-Subscription-Key": config.AZURE_FACE_API_KEY },
//     });

//     this.client = new FaceClient(credentials, config.AZURE_FACE_ENDPOINT);
//   }

//   async detectFaces(
//     imageUrls: string[]
//   ): Promise<Map<string, ProcessedFaceDetection[]>> {
//     const results = new Map<string, ProcessedFaceDetection[]>();

//     const promises = imageUrls.map(async (url: string): Promise<void> => {
//       try {
//         const faces = await this.client.face.detectWithUrl(url, {
//           returnFaceId: true,
//           recognitionModel: "recognition_04",
//           detectionModel: "detection_03",
//         });

//         const detectionResults: ProcessedFaceDetection[] = faces
//           .filter((face): face is AzureFaceDetectionResult =>
//             Boolean(face.faceId && face.faceRectangle)
//           )
//           .map(
//             (face: AzureFaceDetectionResult): ProcessedFaceDetection => ({
//               faceId: face.faceId,
//               boundingBox: {
//                 x: face.faceRectangle.left,
//                 y: face.faceRectangle.top,
//                 width: face.faceRectangle.width,
//                 height: face.faceRectangle.height,
//               },
//               confidence: 0.8, // Default confidence as Azure doesn't return this for detection
//             })
//           );

//         results.set(url, detectionResults);
//       } catch (error) {
//         console.error(`Face detection failed for ${url}:`, error);
//         results.set(url, []);
//       }
//     });

//     await Promise.all(promises);
//     return results;
//   }

//   async groupFaces(faceIds: string[]): Promise<AzureFaceGroupResult> {
//     if (faceIds.length === 0) {
//       return { groups: [], messyGroup: [] };
//     }

//     if (faceIds.length > 1000) {
//       throw new Error("Cannot group more than 1000 faces at once");
//     }

//     try {
//       const result = await this.client.face.group(faceIds);
//       return {
//         groups: result.groups || [],
//         messyGroup: result.messyGroup || [],
//       };
//     } catch (error) {
//       console.error("Face grouping failed:", error);
//       throw error;
//     }
//   }

//   async batchGroupFaces(faceIds: string[]): Promise<AzureFaceGroupResult[]> {
//     const batches: string[][] = [];

//     for (let i = 0; i < faceIds.length; i += 1000) {
//       batches.push(faceIds.slice(i, i + 1000));
//     }

//     const results = await Promise.all(
//       batches.map((batch: string[]) => this.groupFaces(batch))
//     );

//     return results;
//   }
// }

import { FaceClient } from "@azure/cognitiveservices-face";
import { ApiKeyCredentials } from "@azure/ms-rest-js";
import { config } from "@/lib/config/env";
import type {
  AzureFaceDetectionResult,
  AzureFaceGroupResult,
  BoundingBox,
} from "@/lib/types";

export interface ProcessedFaceDetection {
  faceId: string;
  boundingBox: BoundingBox;
  confidence: number;
}

export class AzureFaceService {
  private client: FaceClient;

  constructor() {
    const credentials = new ApiKeyCredentials({
      inHeader: { "Ocp-Apim-Subscription-Key": config.AZURE_FACE_API_KEY },
    });

    this.client = new FaceClient(credentials, config.AZURE_FACE_ENDPOINT);
  }

  async detectFaces(
    imageUrls: string[]
  ): Promise<Map<string, ProcessedFaceDetection[]>> {
    const results = new Map<string, ProcessedFaceDetection[]>();

    console.log(
      `Processing ${imageUrls.length} images sequentially to respect rate limits...`
    );

    // Process one image at a time to avoid rate limiting
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];

      try {
        console.log(`Processing image ${i + 1}/${imageUrls.length}`);

        const faces = await this.client.face.detectWithUrl(url, {
          returnFaceId: true,
        });

        const detectionResults: ProcessedFaceDetection[] = faces
          .filter((face): face is AzureFaceDetectionResult =>
            Boolean(face.faceId && face.faceRectangle)
          )
          .map(
            (face: AzureFaceDetectionResult): ProcessedFaceDetection => ({
              faceId: face.faceId,
              boundingBox: {
                x: face.faceRectangle.left,
                y: face.faceRectangle.top,
                width: face.faceRectangle.width,
                height: face.faceRectangle.height,
              },
              confidence: 0.8,
            })
          );

        results.set(url, detectionResults);
        console.log(`Found ${detectionResults.length} faces in image ${i + 1}`);

        // Wait 4 seconds between requests (20 calls/minute = 1 call per 3 seconds + safety buffer)
        if (i < imageUrls.length - 1) {
          console.log("Waiting 4 seconds before next request...");
          await new Promise((resolve) => setTimeout(resolve, 4000));
        }
      } catch (error) {
        console.error(`Face detection failed for image ${i + 1}:`, error);
        results.set(url, []);

        // Handle rate limiting with proper type checking
        if (error && typeof error === "object" && "statusCode" in error) {
          const typedError = error as { statusCode: number };
          if (typedError.statusCode === 429) {
            console.log("Rate limited! Waiting 70 seconds...");
            await new Promise((resolve) => setTimeout(resolve, 70000));
            // Retry this image
            i--; // Retry the same image
          }
        }
      }
    }

    console.log(`Face detection complete. Processed ${results.size} images.`);
    return results;
  }

  async groupFaces(faceIds: string[]): Promise<AzureFaceGroupResult> {
    if (faceIds.length === 0) {
      return { groups: [], messyGroup: [] };
    }

    if (faceIds.length > 1000) {
      throw new Error("Cannot group more than 1000 faces at once");
    }

    try {
      const result = await this.client.face.group(faceIds);
      return {
        groups: result.groups || [],
        messyGroup: result.messyGroup || [],
      };
    } catch (error) {
      console.error("Face grouping failed:", error);
      throw error;
    }
  }

  async batchGroupFaces(faceIds: string[]): Promise<AzureFaceGroupResult[]> {
    const batches: string[][] = [];

    for (let i = 0; i < faceIds.length; i += 1000) {
      batches.push(faceIds.slice(i, i + 1000));
    }

    const results = await Promise.all(
      batches.map((batch: string[]) => this.groupFaces(batch))
    );

    return results;
  }
}
