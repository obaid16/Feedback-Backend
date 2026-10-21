import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let isConnected = false;
let memoryServer = null;

function setupConnectionListeners() {
  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
    isConnected = false;
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
    isConnected = true;
  });
}

export async function connectDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) {
    logger.debug('Using existing database connection');
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);

  // 1. Attempt connection to configured MONGODB_URI
  try {
    const isDev = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
    const serverSelectionTimeoutMS = isDev ? 2500 : 10000;

    const connection = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      minPoolSize: env.MONGODB_MIN_POOL_SIZE,
      serverSelectionTimeoutMS,
      socketTimeoutMS: 45000,
      family: 4 // IPv4
    });

    isConnected = !!connection.connections[0].readyState;
    setupConnectionListeners();
    logger.info(`Successfully connected to external MongoDB: ${mongoose.connection.name}`);
    return connection;
  } catch (err) {
    // 2. In development, fallback to embedded MongoMemoryServer if local mongod is not running
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      logger.warn(
        { err: err.message },
        'Standard MongoDB daemon not running locally. Starting embedded in-memory MongoDB fallback...'
      );

      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        const memoryUri = memoryServer.getUri();

        const connection = await mongoose.connect(memoryUri);
        isConnected = !!connection.connections[0].readyState;
        setupConnectionListeners();
        logger.info(`Embedded in-memory MongoDB initialized successfully at ${memoryUri}`);

        // Automatically seed default institutional accounts
        try {
          const { User } = await import('../models/User.js');
          const userCount = await User.countDocuments();
          if (userCount === 0) {
            const { seedDatabase } = await import('../scripts/seed.js');
            await seedDatabase(false);
            logger.info('In-memory database seeded automatically with default admin and student accounts.');
          }
        } catch (seedErr) {
          logger.warn({ seedErr: seedErr.message }, 'Automatic in-memory seeding completed or skipped.');
        }

        return connection;
      } catch (memErr) {
        logger.error({ memErr }, 'Failed to initialize in-memory MongoDB server');
        throw memErr;
      }
    }

    logger.error({ err }, 'Failed to connect to MongoDB');
    throw err;
  }
}

export async function disconnectDatabase() {
  if (!isConnected) return;
  try {
    await mongoose.disconnect();
    if (memoryServer) {
      await memoryServer.stop();
      memoryServer = null;
    }
    isConnected = false;
    logger.info('MongoDB disconnected gracefully');
  } catch (err) {
    logger.error({ err }, 'Error during MongoDB disconnection');
  }
}

export function isDatabaseHealthy() {
  return mongoose.connection.readyState === 1;
}
