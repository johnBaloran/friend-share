import dotenv from 'dotenv';
dotenv.config();

import { initSentry, captureException } from '../config/sentry.js';
import { database } from '../infrastructure/database/mongoose/connection.js';
import { workers } from './processors.js';

// Initialize Sentry for worker error tracking
initSentry();

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down workers gracefully...`);

  try {
    // Close all workers
    await Promise.all(workers.map((worker) => worker.close()));
    console.log('All workers closed successfully');

    // Exit process
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start workers
const startWorkers = async () => {
  try {
    console.log('=================================');
    console.log('Face Media Sharing - Worker Process');
    console.log('=================================\n');

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await database.connect();
    console.log('✅ MongoDB connected\n');

    // Log worker status
    console.log('Starting BullMQ workers:');
    workers.forEach((worker) => {
      console.log(`  - ${worker.name} (concurrency: ${worker.opts.concurrency || 1})`);
    });
    console.log('\n✅ All workers started and listening for jobs\n');

    // Log worker events
    workers.forEach((worker) => {
      worker.on('completed', (job) => {
        console.log(`✅ [${worker.name}] Job ${job.id} completed`);
      });

      worker.on('failed', (job, err) => {
        console.error(`❌ [${worker.name}] Job ${job?.id} failed:`, err.message);

        // Capture failed job errors in Sentry
        captureException(err, {
          worker: worker.name,
          jobId: job?.id,
          jobData: job?.data,
        });
      });

      worker.on('error', (err) => {
        console.error(`❌ [${worker.name}] Worker error:`, err);

        // Capture worker errors in Sentry
        captureException(err, {
          worker: worker.name,
          type: 'worker_error',
        });
      });
    });

    console.log('Workers are now processing jobs...');
  } catch (error) {
    console.error('Failed to start workers:', error);
    process.exit(1);
  }
};

// Start the worker process
startWorkers();
