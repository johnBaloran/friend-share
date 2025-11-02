import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { clerkMiddleware } from '@clerk/express';

import { env } from './config/env.js';
import { database } from './infrastructure/database/mongoose/connection.js';
import routes from './presentation/routes/index.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import { requireAuthJson } from './presentation/middleware/clerkAuth.js';

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

// Logging
if (env.isDevelopment()) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Clerk Authentication Middleware
app.use(clerkMiddleware());

// Public Health Check (no auth required)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.get('NODE_ENV'),
  });
});

// Protected API Routes
app.use(env.get('API_PREFIX'), requireAuthJson, routes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error Handler (must be last)
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
