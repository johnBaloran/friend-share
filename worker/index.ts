import { QueueManager } from "@/lib/queues/manager";
import { config } from "@/lib/config/env";

async function startWorker(): Promise<void> {
  console.log("Starting Face Media Sharing Worker...");
  console.log("Environment:", config.NODE_ENV);

  try {
    await QueueManager.startWorkers();

    console.log("All workers started successfully");
    console.log("Worker is now processing jobs...");
  } catch (error) {
    console.error("Failed to start worker:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the worker
startWorker();
