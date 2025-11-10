import { Router } from 'express';
import { GdprController } from '../controllers/GdprController.js';
import { strictLimiter } from '../middleware/rateLimiter.js';

export function createGdprRoutes(controller: GdprController): Router {
  const router = Router();

  /**
   * GDPR compliance endpoints
   * These endpoints allow users to exercise their data rights:
   * - Right to Access (data export)
   * - Right to Erasure (account deletion)
   */

  // Export user data
  router.get('/export', strictLimiter, controller.exportData);

  // Delete user account and all data
  router.delete('/delete-account', strictLimiter, controller.deleteAccount);

  return router;
}
