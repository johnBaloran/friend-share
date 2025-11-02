import { IBoundingBox, IQuality, IPose, IEnhancedFace } from '../../shared/types/index.js';

export class FaceDetection {
  constructor(
    public readonly id: string,
    public readonly mediaId: string,
    public readonly rekognitionFaceId: string,
    public readonly boundingBox: IBoundingBox,
    public readonly confidence: number,
    public readonly processed: boolean,
    public readonly quality?: IQuality,
    public readonly pose?: IPose,
    public readonly qualityScore?: number,
    public readonly enhancedFace?: IEnhancedFace,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static create(data: {
    mediaId: string;
    rekognitionFaceId: string;
    boundingBox: IBoundingBox;
    confidence: number;
    quality?: IQuality;
    pose?: IPose;
    qualityScore?: number;
    enhancedFace?: IEnhancedFace;
  }): FaceDetection {
    return new FaceDetection(
      '', // ID will be assigned by repository
      data.mediaId,
      data.rekognitionFaceId,
      data.boundingBox,
      data.confidence,
      false, // Not processed initially
      data.quality,
      data.pose,
      data.qualityScore,
      data.enhancedFace
    );
  }

  markAsProcessed(): FaceDetection {
    return new FaceDetection(
      this.id,
      this.mediaId,
      this.rekognitionFaceId,
      this.boundingBox,
      this.confidence,
      true,
      this.quality,
      this.pose,
      this.qualityScore,
      this.enhancedFace,
      this.createdAt,
      new Date()
    );
  }

  setEnhancedFace(enhancedFace: IEnhancedFace): FaceDetection {
    return new FaceDetection(
      this.id,
      this.mediaId,
      this.rekognitionFaceId,
      this.boundingBox,
      this.confidence,
      this.processed,
      this.quality,
      this.pose,
      this.qualityScore,
      enhancedFace,
      this.createdAt,
      new Date()
    );
  }

  isHighQuality(threshold: number = 50): boolean {
    return (this.qualityScore ?? 0) >= threshold;
  }
}
