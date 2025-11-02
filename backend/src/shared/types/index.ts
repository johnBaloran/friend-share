import { MemberRole, JobType, JobStatus, ActivityType } from '../constants/index.js';

// Extract types from constants
export type MemberRoleType = (typeof MemberRole)[keyof typeof MemberRole];
export type JobTypeType = (typeof JobType)[keyof typeof JobType];
export type JobStatusType = (typeof JobStatus)[keyof typeof JobStatus];
export type ActivityTypeType = (typeof ActivityType)[keyof typeof ActivityType];

// Common Types
export interface IBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IQuality {
  brightness: number;
  sharpness: number;
}

export interface IPose {
  roll: number;
  yaw: number;
  pitch: number;
}

export interface IEnhancedFace {
  s3Key: string;
  s3Bucket: string;
  width: number;
  height: number;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// AWS Types
export interface S3UploadResult {
  key: string;
  bucket: string;
  url: string;
}

export interface RekognitionFaceData {
  faceId: string;
  boundingBox: IBoundingBox;
  confidence: number;
  quality?: IQuality;
  pose?: IPose;
}

export interface FaceSimilarity {
  faceId: string;
  similarity: number;
}

// File Upload
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
