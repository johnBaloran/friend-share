import { Request, Response } from 'express';
import { IQueueService } from '../../core/interfaces/services/IQueueService.js';
import { IGroupRepository } from '../../core/interfaces/repositories/IGroupRepository.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../../shared/errors/AppError.js';
import { RedisCacheService, CacheKeys, CacheTTL } from '../../infrastructure/cache/RedisCacheService.js';

export class JobController {
  constructor(
    private queueService: IQueueService,
    private groupRepository: IGroupRepository,
    private cacheService: RedisCacheService
  ) {}

  /**
   * Get job status by ID
   * GET /api/jobs/:jobId
   */
  getJobStatus = asyncHandler(async (req: Request, res: Response) => {
    const jobId = req.params.jobId;

    // Cache job status with short TTL (5 min) since it changes frequently
    const jobStatus = await this.cacheService.wrap(
      CacheKeys.jobStatus(jobId),
      async () => this.queueService.getJobById(jobId),
      CacheTTL.SHORT
    );

    if (!jobStatus) {
      throw new NotFoundError('Job not found');
    }

    return res.json({
      success: true,
      data: jobStatus,
    });
  });

  /**
   * Cancel a job
   * DELETE /api/jobs/:jobId
   */
  cancelJob = asyncHandler(async (req: Request, res: Response) => {
    const jobId = req.params.jobId;

    const cancelled = await this.queueService.cancelJob(jobId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Job not found or cannot be cancelled',
      });
    }

    // Invalidate job status cache
    await this.cacheService.delete(CacheKeys.jobStatus(jobId));

    return res.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  });

  /**
   * List jobs for a group
   * GET /api/groups/:groupId/jobs
   */
  listGroupJobs = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const groupId = req.params.groupId;

    // Verify user has access to the group
    const group = await this.groupRepository.findByIdAndUserId(groupId, userId);
    if (!group) {
      throw new NotFoundError('Group not found or you do not have access');
    }

    // Cache group jobs with short TTL (5 min) since they change frequently
    const cacheKey = `jobs:group:${groupId}`;
    const jobs = await this.cacheService.wrap(
      cacheKey,
      async () => this.queueService.getJobsByGroupId(groupId),
      CacheTTL.SHORT
    );

    return res.json({
      success: true,
      data: jobs,
    });
  });
}
