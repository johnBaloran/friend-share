import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { clerkMiddleware } from '@clerk/express';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { initSentry } from './config/sentry.js';
import { setupExpressErrorHandler } from '@sentry/node';
import { database } from './infrastructure/database/mongoose/connection.js';
import routes from './presentation/routes/index.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import { sanitizeBody } from './presentation/middleware/validate.js';

// Initialize Sentry FIRST (before any other imports or middleware)
initSentry();

const app = express();

// Security & Performance Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: env.get('CORS_ORIGIN'),
    credentials: true,
  })
);

// Body Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Sanitize request bodies (remove null/undefined/empty values)
app.use(sanitizeBody);

// Logging
if (env.isDevelopment()) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Clerk Authentication Middleware
app.use(clerkMiddleware());

// Public Health Check (no auth required, no rate limit)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.get('NODE_ENV'),
  });
});

// Apply rate limiting to all API routes (increased for polling)
// Note: Frontend polls media/clusters every 5s while processing
// 2 requests × 12/min × 15min = 360 requests, so increased to 500
const lenientApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to support polling
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(env.get('API_PREFIX'), lenientApiLimiter);

// Mount all routes (public routes are handled within the router)
// Note: Public routes (like /public/share/:token) don't require auth
app.use(env.get('API_PREFIX'), routes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Sentry Error Handler (must be before custom error handlers)
setupExpressErrorHandler(app);

// Custom Error Handler (must be last)
app.use(errorHandler);

// Start Server
const start = async () => {
  try {
    // Connect to MongoDB
    await database.connect();

    const port = env.get('PORT');
    app.listen(port, () => {
      console.log(`
🚀 Server is running!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Port:        ${port}
🌍 Environment: ${env.get('NODE_ENV')}
🔗 API:         http://localhost:${port}${env.get('API_PREFIX')}
📊 Health:      http://localhost:${port}/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

start();

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await database.disconnect();
  process.exit(0);
});
