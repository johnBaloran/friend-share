export class Media {
  constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly uploaderId: string,
    public readonly filename: string,
    public readonly originalName: string,
    public readonly s3Key: string,
    public readonly s3Bucket: string,
    public readonly url: string,
    public readonly mimeType: string,
    public readonly fileSize: number,
    public readonly processed: boolean,
    public readonly width?: number,
    public readonly height?: number,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static create(data: {
    groupId: string;
    uploaderId: string;
    filename: string;
    originalName: string;
    s3Key: string;
    s3Bucket: string;
    url: string;
    mimeType: string;
    fileSize: number;
    width?: number;
    height?: number;
  }): Media {
    return new Media(
      '', // ID will be assigned by repository
      data.groupId,
      data.uploaderId,
      data.filename,
      data.originalName,
      data.s3Key,
      data.s3Bucket,
      data.url,
      data.mimeType,
      data.fileSize,
      false, // Not processed initially
      data.width,
      data.height
    );
  }

  markAsProcessed(): Media {
    return new Media(
      this.id,
      this.groupId,
      this.uploaderId,
      this.filename,
      this.originalName,
      this.s3Key,
      this.s3Bucket,
      this.url,
      this.mimeType,
      this.fileSize,
      true,
      this.width,
      this.height,
      this.createdAt,
      new Date()
    );
  }

  isImage(): boolean {
    return this.mimeType.startsWith('image/');
  }
}
