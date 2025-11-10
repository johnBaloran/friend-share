import { Router } from 'express';
import { MediaController } from '../controllers/MediaController.js';
import { upload, handleUploadError } from '../middleware/upload.js';
import { uploadLimiter, downloadLimiter, readLimiter, imageLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  mongoIdSchema,
  groupIdSchema,
  listGroupMediaSchema,
} from '../validation/schemas.js';

export function createMediaRoutes(controller: MediaController): Router {
  const router = Router();

  // Proxy endpoint for CORS-free image access (must be before /:id routes)
  router.get('/proxy', imageLimiter, controller.proxy);

  // Media by ID routes
  router.get('/:id', readLimiter, validate(mongoIdSchema), controller.getById);
  router.delete('/:id', validate(mongoIdSchema), controller.delete);
  router.get('/:id/download', downloadLimiter, validate(mongoIdSchema), controller.getDownloadUrl);

  return router;
}

export function createGroupMediaRoutes(controller: MediaController): Router {
  const router = Router();

  // Upload media to group
  router.post(
    '/:groupId/upload',
    uploadLimiter,
    validate(groupIdSchema),
    upload.array('files', 50),
    handleUploadError,
    controller.upload
  );

  // List media for group
  router.get('/:groupId/media', readLimiter, validate(listGroupMediaSchema), controller.listByGroup);

  // Bulk download media as ZIP
  router.post('/:groupId/media/download-bulk', downloadLimiter, validate(groupIdSchema), controller.bulkDownload);

  return router;
}
