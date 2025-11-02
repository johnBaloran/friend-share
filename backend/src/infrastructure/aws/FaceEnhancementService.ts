import sharp from 'sharp';
import { IFaceEnhancementService, EnhancedFaceResult } from '../../core/interfaces/services/IFaceEnhancementService.js';
import { IBoundingBox } from '../../shared/types/index.js';
import { DEFAULTS } from '../../shared/constants/index.js';

export class FaceEnhancementService implements IFaceEnhancementService {
  async enhanceFace(
    imageBuffer: Buffer,
    boundingBox: IBoundingBox,
    targetSize: number = DEFAULTS.ENHANCED_FACE_SIZE
  ): Promise<EnhancedFaceResult> {
    try {
      // Get image metadata to calculate pixel coordinates
      const metadata = await sharp(imageBuffer).metadata();
      const imgWidth = metadata.width!;
      const imgHeight = metadata.height!;

      // Convert bounding box ratios (0-1) to pixel coordinates
      const cropX = Math.round(boundingBox.x * imgWidth);
      const cropY = Math.round(boundingBox.y * imgHeight);
      const cropWidth = Math.round(boundingBox.width * imgWidth);
      const cropHeight = Math.round(boundingBox.height * imgHeight);

      // Add 20% padding around face for better context
      const padding = 0.2;
      const paddedX = Math.max(0, Math.round(cropX - cropWidth * padding));
      const paddedY = Math.max(0, Math.round(cropY - cropHeight * padding));
      const paddedWidth = Math.min(imgWidth - paddedX, Math.round(cropWidth * (1 + padding * 2)));
      const paddedHeight = Math.min(imgHeight - paddedY, Math.round(cropHeight * (1 + padding * 2)));

      // Enhancement pipeline
      const enhanced = await sharp(imageBuffer)
        // Step 1: Crop to face with padding
        .extract({
          left: paddedX,
          top: paddedY,
          width: paddedWidth,
          height: paddedHeight,
        })
        // Step 2: Resize to optimal size (default: 600x600)
        // Lanczos3 kernel provides best quality for face details
        .resize(targetSize, targetSize, {
          kernel: 'lanczos3',
          fit: 'cover',
          position: 'center',
        })
        // Step 3: Normalize lighting and contrast
        // Auto-adjusts histogram for optimal distribution
        .normalize()
        // Step 4: Slight brightness boost
        // linear(a, b) applies: output = a * input + b
        .linear(1.05, 5)
        // Step 5: Sharpen facial features
        // Sigma 1.5 provides good detail without artifacts
        .sharpen({
          sigma: 1.5,
          m1: 1.0,
          m2: 0.2,
        })
        // Step 6: Reduce noise
        // Median filter removes noise while preserving edges
        .median(1)
        // Step 7: Convert to JPEG (Rekognition supports JPEG/PNG for byte input)
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();

      return {
        buffer: enhanced,
        width: targetSize,
        height: targetSize,
      };
    } catch (error) {
      console.error('Failed to enhance face:', error);
      throw error;
    }
  }

  async enhanceMultipleFaces(
    imageBuffer: Buffer,
    boundingBoxes: IBoundingBox[],
    targetSize: number = DEFAULTS.ENHANCED_FACE_SIZE
  ): Promise<EnhancedFaceResult[]> {
    console.log(`Batch enhancing ${boundingBoxes.length} faces`);

    const enhancedFaces = await Promise.all(
      boundingBoxes.map(bbox => this.enhanceFace(imageBuffer, bbox, targetSize))
    );

    console.log(`Batch enhancement complete: ${enhancedFaces.length} faces`);
    return enhancedFaces;
  }
}
