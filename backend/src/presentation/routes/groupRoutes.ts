import { Router } from 'express';
import { GroupController } from '../controllers/GroupController.js';
import { readLimiter, strictLimiter } from '../middleware/rateLimiter.js';
import { validate, sanitizeBody } from '../middleware/validate.js';
import {
  createGroupSchema,
  joinGroupSchema,
  updateMemberSchema,
  mongoIdSchema,
  paginationSchema,
} from '../validation/schemas.js';

export function createGroupRoutes(controller: GroupController): Router {
  const router = Router();

  // Group CRUD
  router.post('/', sanitizeBody, validate(createGroupSchema), controller.create);
  router.post('/join', sanitizeBody, validate(joinGroupSchema), controller.join);
  router.get('/', readLimiter, validate(paginationSchema), controller.list);
  router.get('/:id', readLimiter, validate(mongoIdSchema), controller.getById);
  router.put('/:id', sanitizeBody, validate(mongoIdSchema), controller.update);
  router.delete('/:id', strictLimiter, validate(mongoIdSchema), controller.delete);

  // Storage and members
  router.get('/:id/storage', readLimiter, validate(mongoIdSchema), controller.getStorage);
  router.get('/:id/members', readLimiter, validate(mongoIdSchema), controller.getMembers);
  router.patch(
    '/:groupId/members/:memberId',
    sanitizeBody,
    validate(updateMemberSchema),
    controller.updateMember
  );
  router.delete('/:groupId/members/:memberId', validate(updateMemberSchema), controller.removeMember);

  // Operations (strict limit for resource-intensive operations)
  router.post('/:id/recluster', strictLimiter, validate(mongoIdSchema), controller.recluster);
  router.post('/:id/cleanup', strictLimiter, validate(mongoIdSchema), controller.cleanup);

  return router;
}
