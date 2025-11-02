import { Queue, QueueOptions, Job } from 'bullmq';
import { IQueueService, JobData, JobOptions, JobStatus } from '../../core/interfaces/services/IQueueService.js';
import { JobTypeType } from '../../shared/types/index.js';
import { QUEUE_NAMES } from '../../shared/constants/index.js';
import { env } from '../../config/env.js';

export class BullMQService implements IQueueService {
  private queues: Map<string, Queue> = new Map();
  private connection: QueueOptions['connection'];

  constructor() {
    this.connection = {
      url: env.get('REDIS_URL'),
    };
  }

  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      this.queues.set(
        queueName,
        new Queue(queueName, {
          connection: this.connection,
        })
      );
    }
    return this.queues.get(queueName)!;
  }

  async addJob(
    queueName: string,
    jobType: JobTypeType,
    data: JobData,
    options?: JobOptions
  ): Promise<string> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobType, data, options);
    return job.id!;
  }

  async getJob(queueName: string, jobId: string): Promise<any> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  async getJobStatus(
    queueName: string,
    jobId: string
  ): Promise<{
    status: string;
    progress?: number;
    result?: any;
    error?: string;
  }> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return { status: 'NOT_FOUND' };
    }

    const state = await job.getState();
    const progress = job.progress as number | undefined;

    return {
      status: state,
      progress,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  async clearQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
  }

  // New methods for job management across queues
  async getJobById(jobId: string): Promise<JobStatus | null> {
    const allQueueNames = Object.values(QUEUE_NAMES);

    for (const queueName of allQueueNames) {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (job) {
        return this.jobToStatus(job, queueName);
      }
    }

    return null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const allQueueNames = Object.values(QUEUE_NAMES);

    for (const queueName of allQueueNames) {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (job) {
        const state = await job.getState();

        // Can only cancel jobs that are waiting, delayed, or active
        if (['waiting', 'delayed', 'active'].includes(state)) {
          await job.remove();
          return true;
        }

        return false;
      }
    }

    return false;
  }

  async getJobsByGroupId(groupId: string): Promise<JobStatus[]> {
    const allQueueNames = Object.values(QUEUE_NAMES);
    const jobStatuses: JobStatus[] = [];

    for (const queueName of allQueueNames) {
      const queue = this.getQueue(queueName);

      // Get jobs in different states
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(0, 100),
        queue.getFailed(0, 100),
        queue.getDelayed(0, 100),
      ]);

      const allJobs = [...waiting, ...active, ...completed, ...failed, ...delayed];

      // Filter jobs by groupId
      for (const job of allJobs) {
        if (job.data.groupId === groupId) {
          jobStatuses.push(await this.jobToStatus(job, queueName));
        }
      }
    }

    // Sort by creation date (newest first)
    return jobStatuses.sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  private async jobToStatus(job: Job, queueName: string): Promise<JobStatus> {
    const state = await job.getState();

    return {
      id: job.id!,
      status: state,
      progress: job.progress as number | undefined,
      result: job.returnvalue,
      error: job.failedReason,
      queueName,
      jobType: job.name,
      groupId: job.data.groupId,
      createdAt: job.timestamp ? new Date(job.timestamp) : undefined,
      processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  async close(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();
  }
}
