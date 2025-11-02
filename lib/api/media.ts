import { api } from './client';

export interface Media {
  id: string;
  groupId: string;
  uploaderId: string;
  filename: string;
  originalName: string;
  s3Key: string;
  s3Bucket: string;
  url: string;
  mimeType: string;
  fileSize: number;
  isProcessed: boolean;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  faceCount?: number;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  presignedUrl?: string;
}

export interface MediaListResponse {
  success: boolean;
  data: Media[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MediaResponse {
  success: boolean;
  data: Media;
  message?: string;
}

export interface UploadMediaResponse {
  success: boolean;
  data: Media[];
  jobId: string;
  message?: string;
}

export interface DownloadUrlResponse {
  success: boolean;
  data: {
    url: string;
    filename: string;
    expiresIn: number;
  };
}

// Media API functions
export const mediaApi = {
  /**
   * Upload media files to a group
   */
  upload: async (groupId: string, files: File[]): Promise<UploadMediaResponse> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    return api.upload<UploadMediaResponse>(`/groups/${groupId}/upload`, formData);
  },

  /**
   * List media for a group
   */
  listByGroup: async (
    groupId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<MediaListResponse> => {
    return api.get<MediaListResponse>(`/groups/${groupId}/media?page=${page}&limit=${limit}`);
  },

  /**
   * Get a single media item by ID
   */
  getById: async (mediaId: string): Promise<Media> => {
    const response = await api.get<MediaResponse>(`/media/${mediaId}`);
    return response.data;
  },

  /**
   * Delete a media item
   */
  delete: async (mediaId: string): Promise<void> => {
    await api.delete(`/media/${mediaId}`);
  },

  /**
   * Get download URL for media
   */
  getDownloadUrl: async (mediaId: string): Promise<DownloadUrlResponse> => {
    return api.get<DownloadUrlResponse>(`/media/${mediaId}/download`);
  },

  /**
   * Download media file
   */
  download: async (mediaId: string): Promise<void> => {
    const response = await mediaApi.getDownloadUrl(mediaId);
    // Open the download URL in a new window
    window.open(response.data.url, '_blank');
  },
};
