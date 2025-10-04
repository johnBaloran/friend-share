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
}

// Media Types
export interface IMedia extends BaseDocument {
  groupId: mongoose.Types.ObjectId;
  uploaderId: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  cloudinaryUrl: string;
  publicId: string;
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
  azureFaceId: string;
  boundingBox: BoundingBox;
  confidence: number;
  processed: boolean;
  expiresAt: Date;
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

// Azure Face API Types
export interface AzureFaceDetectionResult {
  faceId: string;
  faceRectangle: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface AzureFaceGroupResult {
  groups: string[][];
  messyGroup: string[];
}

// Cloudinary Types
export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
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
