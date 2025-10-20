import mongoose from "mongoose";

// Base Types
export interface BaseDocument {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

// User Types
export interface IUser extends BaseDocument {
  clerkId: string;
  email: string;
  name?: string;
  avatar?: string;
  emailVerified?: Date;
}

// Group Types
export interface IGroupMember {
  userId: mongoose.Types.ObjectId;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  permissions: {
    canUpload: boolean;
    canDownload: boolean;
    canDelete: boolean;
  };
  joinedAt: Date;
}

export interface IGroup extends BaseDocument {
  name: string;
  description?: string;
  inviteCode: string;
  creatorId: mongoose.Types.ObjectId;
  members: IGroupMember[];
  storageLimit: number;
  storageUsed: number;
  autoDeleteDays: number;
  rekognitionCollectionId?: string;
}

// Media Types
export interface IMedia extends BaseDocument {
  groupId: mongoose.Types.ObjectId;
  uploaderId: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  s3Key: string;
  s3Bucket: string;
  url: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  processed: boolean;
}

// Face Detection Types
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IFaceDetection extends BaseDocument {
  mediaId: mongoose.Types.ObjectId;
  rekognitionFaceId: string;
  boundingBox: BoundingBox;
  confidence: number;
  processed: boolean;
}

export interface IFaceCluster extends BaseDocument {
  groupId: mongoose.Types.ObjectId;
  clusterName?: string;
  appearanceCount: number;
  confidence: number;
}

export interface IFaceClusterMember extends BaseDocument {
  clusterId: mongoose.Types.ObjectId;
  faceDetectionId: mongoose.Types.ObjectId;
  confidence: number;
}

// Job Types
export type JobType = "FACE_DETECTION" | "FACE_GROUPING" | "MEDIA_CLEANUP";
export type JobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface IJobStatus extends BaseDocument {
  jobId: string;
  jobType: JobType;
  groupId?: string;
  status: JobStatus;
  progress: number;
  totalItems?: number;
  processedItems: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
}

// AWS Rekognition Types
export interface RekognitionFaceDetection {
  faceId?: string;
  boundingBox: BoundingBox;
  confidence: number;
  imageId?: string;
}

export interface RekognitionSearchResult {
  faceId: string;
  similarity: number;
  imageId?: string;
}

// AWS S3 Types
export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  contentType: string;
}

// Job Queue Types
export interface BaseJobData {
  groupId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface FaceDetectionJobData extends BaseJobData {
  mediaIds: string[];
}

export interface FaceGroupingJobData extends BaseJobData {
  faceDetectionIds: string[];
  batchNumber?: number;
}

export interface CleanupJobData extends BaseJobData {
  targetDate: Date;
  mediaIds?: string[];
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: unknown; // Add this for validation errors
}
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
