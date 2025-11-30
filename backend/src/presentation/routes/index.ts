import { Router } from 'express';
import { createGroupRoutes } from './groupRoutes.js';
import { createMediaRoutes, createGroupMediaRoutes } from './mediaRoutes.js';
import { createClusterRoutes, createGroupClusterRoutes } from './clusterRoutes.js';
import { createJobRoutes, createGroupJobRoutes } from './jobRoutes.js';
import { createGdprRoutes } from './gdprRoutes.js';
import { createShareRoutes, createPublicShareRoutes } from './shareRoutes.js';
import { webhookRoutes } from './webhooks.js';
import { container } from '../../di/container.js';
import { GroupController } from '../controllers/GroupController.js';
import { MediaController } from '../controllers/MediaController.js';
import { ClusterController } from '../controllers/ClusterController.js';
import { JobController } from '../controllers/JobController.js';
import { GdprController } from '../controllers/GdprController.js';
import { ShareController } from '../controllers/ShareController.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get controllers from container
const groupController = container.get<GroupController>('GroupController');
const mediaController = container.get<MediaController>('MediaController');
const clusterController = container.get<ClusterController>('ClusterController');
const jobController = container.get<JobController>('JobController');
const gdprController = container.get<GdprController>('GdprController');
const shareController = container.get<ShareController>('ShareController');

// Routes
router.use('/groups', createGroupRoutes(groupController));
router.use('/groups', createGroupMediaRoutes(mediaController));
router.use('/groups', createGroupClusterRoutes(clusterController));
router.use('/groups', createGroupJobRoutes(jobController));
router.use('/media', createMediaRoutes(mediaController));
router.use('/clusters', createClusterRoutes(clusterController));
router.use('/jobs', createJobRoutes(jobController));
router.use('/gdpr', createGdprRoutes(gdprController));
router.use('/share', createShareRoutes(shareController));

// Public routes (no auth required)
router.use('/public/share', createPublicShareRoutes(shareController));

// Webhook routes (no auth required - verified via Svix signature)
router.use('/webhooks', webhookRoutes);

export default router;
