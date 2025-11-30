import { Router } from 'express';
import { GroupController } from '../controllers/GroupController.js';
import { readLimiter, strictLimiter } from '../middleware/rateLimiter.js';
import { validate, sanitizeBody } from '../middleware/validate.js';
import { requireAuthJson } from '../middleware/clerkAuth.js';
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
  router.post('/', requireAuthJson, sanitizeBody, validate(createGroupSchema), controller.create);
  router.post('/join', requireAuthJson, sanitizeBody, validate(joinGroupSchema), controller.join);
  router.get('/', requireAuthJson, readLimiter, validate(paginationSchema), controller.list);
  router.get('/:id', requireAuthJson, readLimiter, validate(mongoIdSchema), controller.getById);
  router.put('/:id', requireAuthJson, sanitizeBody, validate(mongoIdSchema), controller.update);
  router.delete('/:id', requireAuthJson, strictLimiter, validate(mongoIdSchema), controller.delete);

  // Storage and members
  router.get('/:id/storage', requireAuthJson, readLimiter, validate(mongoIdSchema), controller.getStorage);
  router.get('/:id/members', requireAuthJson, readLimiter, validate(mongoIdSchema), controller.getMembers);
  router.patch(
    '/:groupId/members/:memberId',
    requireAuthJson,
    sanitizeBody,
    validate(updateMemberSchema),
    controller.updateMember
  );
  router.delete('/:groupId/members/:memberId', requireAuthJson, validate(updateMemberSchema), controller.removeMember);

  // Operations (strict limit for resource-intensive operations)
  router.post('/:id/recluster', requireAuthJson, strictLimiter, validate(mongoIdSchema), controller.recluster);
  router.post('/:id/cleanup', requireAuthJson, strictLimiter, validate(mongoIdSchema), controller.cleanup);

  return router;
}
