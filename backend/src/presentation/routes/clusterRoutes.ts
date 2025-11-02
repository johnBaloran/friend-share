import { Router } from 'express';
import { ClusterController } from '../controllers/ClusterController.js';

export function createClusterRoutes(controller: ClusterController): Router {
  const router = Router();

  // Cluster by ID routes
  router.get('/:clusterId/media', controller.getClusterMedia);
  router.patch('/:clusterId', controller.updateCluster);
  router.delete('/:clusterId', controller.deleteCluster);

  return router;
}

export function createGroupClusterRoutes(controller: ClusterController): Router {
  const router = Router();

  // List clusters for group
  router.get('/:groupId/clusters', controller.listByGroup);

  return router;
}
