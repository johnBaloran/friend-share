import { Router } from 'express';
import { ClusterController } from '../controllers/ClusterController.js';
import { readLimiter } from '../middleware/rateLimiter.js';
import { validate, sanitizeBody } from '../middleware/validate.js';
import { requireAuthJson } from '../middleware/clerkAuth.js';
import {
  updateClusterSchema,
  listGroupClustersSchema,
  paginationSchema,
} from '../validation/schemas.js';

export function createClusterRoutes(controller: ClusterController): Router {
  const router = Router();

  // Cluster by ID routes
  router.get('/:clusterId/media', requireAuthJson, readLimiter, validate(paginationSchema), controller.getClusterMedia);
  router.patch('/:clusterId', requireAuthJson, sanitizeBody, validate(updateClusterSchema), controller.updateCluster);
  router.delete('/:clusterId', requireAuthJson, controller.deleteCluster);
  router.delete('/:clusterId/faces/:faceDetectionId', requireAuthJson, controller.removeFaceFromCluster);
  router.post('/:clusterId/merge/:targetClusterId', requireAuthJson, controller.mergeClusters);

  return router;
}

export function createGroupClusterRoutes(controller: ClusterController): Router {
  const router = Router();

  // List clusters for group
  router.get('/:groupId/clusters', requireAuthJson, readLimiter, validate(listGroupClustersSchema), controller.listByGroup);

  return router;
}
