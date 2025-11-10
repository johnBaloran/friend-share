import { Router } from 'express';
import { JobController } from '../controllers/JobController.js';
import { readLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  getJobStatusSchema,
  listGroupJobsSchema,
} from '../validation/schemas.js';

export function createJobRoutes(controller: JobController): Router {
  const router = Router();

  // Job by ID routes (job status is frequently polled, use lenient limiter)
  router.get('/:jobId', readLimiter, validate(getJobStatusSchema), controller.getJobStatus);
  router.delete('/:jobId', validate(getJobStatusSchema), controller.cancelJob);

  return router;
}

export function createGroupJobRoutes(controller: JobController): Router {
  const router = Router();

  // List jobs for group
  router.get('/:groupId/jobs', readLimiter, validate(listGroupJobsSchema), controller.listGroupJobs);

  return router;
}
