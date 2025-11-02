import { api } from './client';

export interface JobStatus {
  id: string;
  status: string;
  progress?: number;
  result?: unknown;
  error?: string;
  queueName?: string;
  jobType?: string;
  groupId?: string;
  createdAt?: Date | string;
  processedOn?: Date | string;
  finishedOn?: Date | string;
}

export interface JobStatusResponse {
  success: boolean;
  data: JobStatus;
}

export interface JobListResponse {
  success: boolean;
  data: JobStatus[];
}

// Jobs API functions
export const jobsApi = {
  /**
   * Get job status by ID
   */
  getStatus: async (jobId: string): Promise<JobStatus> => {
    const response = await api.get<JobStatusResponse>(`/jobs/${jobId}`);
    return response.data;
  },

  /**
   * Cancel a job
   */
  cancel: async (jobId: string): Promise<void> => {
    await api.delete(`/jobs/${jobId}`);
  },

  /**
   * List jobs for a group
   */
  listByGroup: async (groupId: string): Promise<JobStatus[]> => {
    const response = await api.get<JobListResponse>(`/groups/${groupId}/jobs`);
    return response.data;
  },
};
