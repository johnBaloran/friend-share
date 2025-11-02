import { Router } from 'express';
import { MediaController } from '../controllers/MediaController.js';
import { upload, handleUploadError } from '../middleware/upload.js';

export function createMediaRoutes(controller: MediaController): Router {
  const router = Router();

  // Media by ID routes
  router.get('/:id', controller.getById);
  router.delete('/:id', controller.delete);
  router.get('/:id/download', controller.getDownloadUrl);

  return router;
}

export function createGroupMediaRoutes(controller: MediaController): Router {
  const router = Router();

  // Upload media to group
  router.post(
    '/:groupId/upload',
    upload.array('files', 50),
    handleUploadError,
    controller.upload
  );

  // List media for group
  router.get('/:groupId/media', controller.listByGroup);

  return router;
}
