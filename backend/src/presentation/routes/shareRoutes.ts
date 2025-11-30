import { Router } from 'express';
import { ShareController } from '../controllers/ShareController.js';
import { requireAuthJson } from '../middleware/clerkAuth.js';

export const createShareRoutes = (controller: ShareController): Router => {
  const router = Router();

  // All share routes require authentication
  router.use(requireAuthJson);

  // Create a shareable link
  router.post('/', controller.create);

  // List shareable links for a resource
  router.get('/:resourceType/:resourceId', controller.list);

  // Revoke a shareable link
  router.delete('/:linkId', controller.revoke);

  return router;
};

export const createPublicShareRoutes = (controller: ShareController): Router => {
  const router = Router();

  // Public route - no authentication required
  // Get shared resource by token
  router.get('/:token', controller.getByToken);

  return router;
};
