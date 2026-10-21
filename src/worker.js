import { connectDatabase, disconnectDatabase } from './config/database.js';
import { startScheduler, stopScheduler } from './services/queue/scheduler.js';
import { startWorker } from './services/queue/worker.js';
import { logger } from './config/logger.js';

let worker = null;

async function bootstrapWorker() {
  try {
    logger.info('Starting dedicated background queue worker & scheduler process...');

    await connectDatabase();

    worker = startWorker();
    startScheduler();

    logger.info('Worker and scheduler process active.');

    const shutdown = async (signal) => {
      logger.info(`Worker received ${signal}. Shutting down...`);
      stopScheduler();
      if (worker) await worker.close();
      await disconnectDatabase();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.fatal({ err }, 'Worker process startup failed');
    process.exit(1);
  }
}

bootstrapWorker();
