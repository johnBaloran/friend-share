import { Router } from 'express';
import { JobController } from '../controllers/JobController.js';

export function createJobRoutes(controller: JobController): Router {
  const router = Router();

  // Job by ID routes
  router.get('/:jobId', controller.getJobStatus);
  router.delete('/:jobId', controller.cancelJob);

  return router;
}

export function createGroupJobRoutes(controller: JobController): Router {
  const router = Router();

  // List jobs for group
  router.get('/:groupId/jobs', controller.listGroupJobs);

  return router;
}
