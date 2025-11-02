import { Router } from 'express';
import { GroupController } from '../controllers/GroupController.js';

export function createGroupRoutes(controller: GroupController): Router {
  const router = Router();

  // Group CRUD
  router.post('/', controller.create);
  router.post('/join', controller.join);
  router.get('/', controller.list);
  router.get('/:id', controller.getById);

  // Storage and members
  router.get('/:id/storage', controller.getStorage);
  router.get('/:id/members', controller.getMembers);
  router.patch('/:groupId/members/:memberId', controller.updateMember);
  router.delete('/:groupId/members/:memberId', controller.removeMember);

  // Operations
  router.post('/:id/recluster', controller.recluster);
  router.post('/:id/cleanup', controller.cleanup);

  return router;
}
