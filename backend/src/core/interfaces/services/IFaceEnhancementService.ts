import { IBoundingBox } from '../../../shared/types/index.js';

export interface EnhancedFaceResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface IFaceEnhancementService {
  /**
   * Enhance a face crop for better recognition accuracy
   * @param imageBuffer Original image buffer
   * @param boundingBox Face bounding box (normalized 0-1)
   * @param targetSize Target size for enhanced face (default: 600x600)
   */
  enhanceFace(
    imageBuffer: Buffer,
    boundingBox: IBoundingBox,
    targetSize?: number
  ): Promise<EnhancedFaceResult>;

  /**
   * Enhance multiple faces from the same image
   */
  enhanceMultipleFaces(
    imageBuffer: Buffer,
    boundingBoxes: IBoundingBox[],
    targetSize?: number
  ): Promise<EnhancedFaceResult[]>;
}
