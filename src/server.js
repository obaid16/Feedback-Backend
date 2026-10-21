import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { startScheduler, stopScheduler } from './services/queue/scheduler.js';
import { startWorker } from './services/queue/worker.js';
import { logger } from './config/logger.js';

let server = null;
let queueWorker = null;

async function bootstrap() {
  try {
    logger.info('Initializing Faculty Feedback & Intelligence Portal Backend...');

    // 1. Connect to MongoDB
    await connectDatabase();

    // 2. Start background worker (if Redis available) and persistent scheduler
    queueWorker = startWorker();
    startScheduler();

    // 3. Start HTTP Server
    server = app.listen(env.PORT, env.HOST, () => {
      logger.info(`🚀 API Server running at http://${env.HOST}:${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV} | Timezone: ${env.DEFAULT_TIMEZONE}`);
    });

    // Graceful shutdown handling
    const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    shutdownSignals.forEach((signal) => {
      process.on(signal, () => handleGracefulShutdown(signal));
    });

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled Promise Rejection detected');
    });

    process.on('uncaughtException', (err) => {
      logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception detected');
      handleGracefulShutdown('UNCAUGHT_EXCEPTION');
    });
  } catch (err) {
    logger.fatal({ err }, 'Fatal error during server bootstrap');
    process.exit(1);
  }
}

async function handleGracefulShutdown(signal) {
  logger.info(`Received ${signal}. Commencing graceful shutdown...`);

  // Stop accepting new HTTP connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Stop background jobs
  stopScheduler();
  if (queueWorker) {
    await queueWorker.close();
    logger.info('Queue worker stopped');
  }

  // Close MongoDB connections
  await disconnectDatabase();

  logger.info('Graceful shutdown completed. Exiting.');
  process.exit(0);
}

bootstrap();
