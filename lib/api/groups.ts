import { api } from './client';

export interface CreateGroupData {
  name: string;
  description?: string;
  storageLimit?: number;
  autoDeleteDays?: number;
}

export interface JoinGroupData {
  inviteCode: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  creatorId: string;
  members: Array<{
    userId: {
      id: string;
      name?: string | null;
      email?: string | null;
      avatar?: string | null;
    };
    role: string;
    permissions: {
      canUpload: boolean;
      canDownload: boolean;
      canDelete: boolean;
    };
    joinedAt: Date;
  }>;
  storageLimit: number;
  storageUsed: number;
  autoDeleteDays: number;
  rekognitionCollectionId?: string;
  mediaCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupListResponse {
  success: boolean;
  data: Group[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GroupResponse {
  success: boolean;
  data: Group;
  message?: string;
}

export interface StorageInfo {
  used: number;
  limit: number;
  percentage: number;
  files: number;
}

export interface StorageResponse {
  success: boolean;
  data: StorageInfo;
}

export interface Member {
  userId: string;
  role: string;
  permissions: {
    canUpload: boolean;
    canDownload: boolean;
    canDelete: boolean;
  };
  joinedAt: Date;
}

export interface MembersResponse {
  success: boolean;
  data: Member[];
}

// Group API functions
export const groupsApi = {
  /**
   * Create a new group
   */
  create: async (data: CreateGroupData): Promise<Group> => {
    const response = await api.post<GroupResponse>('/groups', data);
    return response.data;
  },

  /**
   * Join a group using invite code
   */
  join: async (inviteCode: string): Promise<Group> => {
    const response = await api.post<GroupResponse>('/groups/join', { inviteCode });
    return response.data;
  },

  /**
   * Get all groups for current user
   */
  list: async (page: number = 1, limit: number = 10): Promise<GroupListResponse> => {
    return api.get<GroupListResponse>(`/groups?page=${page}&limit=${limit}`);
  },

  /**
   * Get a specific group by ID
   */
  getById: async (groupId: string): Promise<Group> => {
    const response = await api.get<GroupResponse>(`/groups/${groupId}`);
    return response.data;
  },

  /**
   * Update group details
   */
  update: async (groupId: string, data: Partial<CreateGroupData>): Promise<Group> => {
    const response = await api.put<GroupResponse>(`/groups/${groupId}`, data);
    return response.data;
  },

  /**
   * Delete a group
   */
  delete: async (groupId: string): Promise<void> => {
    await api.delete(`/groups/${groupId}`);
  },

  /**
   * Get storage information for a group
   */
  getStorage: async (groupId: string): Promise<StorageInfo> => {
    const response = await api.get<StorageResponse>(`/groups/${groupId}/storage`);
    return response.data;
  },

  /**
   * Get members of a group
   */
  getMembers: async (groupId: string): Promise<Member[]> => {
    const response = await api.get<MembersResponse>(`/groups/${groupId}/members`);
    return response.data;
  },

  /**
   * Update a member's role or permissions
   */
  updateMember: async (
    groupId: string,
    memberId: string,
    updates: Partial<Member>
  ): Promise<void> => {
    await api.patch(`/groups/${groupId}/members/${memberId}`, updates);
  },

  /**
   * Remove a member from a group
   */
  removeMember: async (groupId: string, memberId: string): Promise<void> => {
    await api.delete(`/groups/${groupId}/members/${memberId}`);
  },

  /**
   * Trigger face reclustering for a group
   */
  recluster: async (groupId: string): Promise<{ jobId: string; message: string }> => {
    const response = await api.post<{ success: boolean; data: { jobId: string; message: string } }>(
      `/groups/${groupId}/recluster`,
      {}
    );
    return response.data;
  },

  /**
   * Cleanup media in a group
   */
  cleanup: async (
    groupId: string,
    options: {
      deleteOlderThan?: string;
      deleteLargerThan?: number;
      deleteUnprocessed?: boolean;
      deleteDuplicates?: boolean;
    }
  ): Promise<{ deletedCount: number; freedSpace: number }> => {
    const response = await api.post<{
      success: boolean;
      data: { deletedCount: number; freedSpace: number };
      message: string;
    }>(`/groups/${groupId}/cleanup`, options);
    return response.data;
  },
};
