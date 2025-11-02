import { JobTypeType } from '../../../shared/types/index.js';

export interface JobData {
  [key: string]: any;
}

export interface JobOptions {
  delay?: number;
  attempts?: number;
  backoff?: number | { type: string; delay: number };
  priority?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export interface JobStatus {
  id: string;
  status: string;
  progress?: number;
  result?: any;
  error?: string;
  queueName?: string;
  jobType?: string;
  groupId?: string;
  createdAt?: Date;
  processedOn?: Date;
  finishedOn?: Date;
}

export interface IQueueService {
  addJob(
    queueName: string,
    jobType: JobTypeType,
    data: JobData,
    options?: JobOptions
  ): Promise<string>;

  getJob(queueName: string, jobId: string): Promise<any>;

  removeJob(queueName: string, jobId: string): Promise<void>;

  getJobStatus(queueName: string, jobId: string): Promise<{
    status: string;
    progress?: number;
    result?: any;
    error?: string;
  }>;

  // New methods for job management
  getJobById(jobId: string): Promise<JobStatus | null>;

  cancelJob(jobId: string): Promise<boolean>;

  getJobsByGroupId(groupId: string): Promise<JobStatus[]>;

  pauseQueue(queueName: string): Promise<void>;

  resumeQueue(queueName: string): Promise<void>;

  clearQueue(queueName: string): Promise<void>;
}
