import { api } from './client';
import { Media } from './media';

export interface ClusterWithSample {
  id: string;
  clusterName?: string;
  appearanceCount: number;
  confidence: number;
  createdAt: Date | string;
  samplePhoto?: {
    thumbnailUrl: string;
  };
  totalPhotos: number;
}

// Alias for convenience
export type Cluster = ClusterWithSample;

export interface FaceDetection {
  id: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface MediaWithFaceInfo extends Media {
  presignedUrl: string;
  faceDetections: FaceDetection[];
}

export interface ClusterMediaData {
  media: MediaWithFaceInfo[];
  cluster: {
    id: string;
    clusterName?: string;
    appearanceCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ClustersListResponse {
  success: boolean;
  data: ClusterWithSample[];
}

export interface ClusterMediaResponse {
  success: boolean;
  data: ClusterMediaData;
}

export interface ClusterUpdateData {
  clusterName?: string;
}

export interface ClusterResponse {
  success: boolean;
  data: ClusterWithSample;
  message?: string;
}

// Cluster API functions
export const clustersApi = {
  /**
   * List clusters for a group with sample photos
   */
  listByGroup: async (groupId: string): Promise<ClusterWithSample[]> => {
    const response = await api.get<ClustersListResponse>(`/groups/${groupId}/clusters`);
    return response.data;
  },

  /**
   * Get media for a specific cluster
   */
  getClusterMedia: async (
    clusterId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ClusterMediaData> => {
    const response = await api.get<ClusterMediaResponse>(
      `/clusters/${clusterId}/media?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  /**
   * Update cluster name
   */
  updateCluster: async (clusterId: string, data: ClusterUpdateData): Promise<void> => {
    await api.patch<ClusterResponse>(`/clusters/${clusterId}`, data);
  },

  /**
   * Delete a cluster
   */
  deleteCluster: async (clusterId: string): Promise<void> => {
    await api.delete(`/clusters/${clusterId}`);
  },

  /**
   * Remove a specific face from a cluster
   * @param clusterId - Cluster ID
   * @param faceDetectionId - Face detection ID to remove
   */
  removeFaceFromCluster: async (clusterId: string, faceDetectionId: string): Promise<{ clusterDeleted: boolean; remainingFaces?: number }> => {
    const response = await api.delete<{ success: boolean; clusterDeleted: boolean; remainingFaces?: number }>(`/clusters/${clusterId}/faces/${faceDetectionId}`);
    return { clusterDeleted: response.clusterDeleted, remainingFaces: response.remainingFaces };
  },

  /**
   * Merge two clusters
   * @param sourceClusterId - Cluster to merge FROM (will be deleted)
   * @param targetClusterId - Cluster to merge INTO (will be kept)
   */
  mergeClusters: async (sourceClusterId: string, targetClusterId: string): Promise<ClusterWithSample> => {
    const response = await api.post<ClusterResponse>(`/clusters/${sourceClusterId}/merge/${targetClusterId}`);
    return response.data;
  },
};
