import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController.js';
import { container } from '../../di/container.js';

const router = Router();
const webhookController = container.get<WebhookController>('WebhookController');

/**
 * Clerk webhook endpoint
 * POST /api/webhooks/clerk
 *
 * Note: This endpoint does NOT use requireAuthJson middleware
 * because webhooks come from Clerk's servers, not authenticated users
 */
router.post('/clerk', webhookController.handleClerkWebhook);

export { router as webhookRoutes };
