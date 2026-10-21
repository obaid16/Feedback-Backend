import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

let redisClient = null;
let campaignQueue = null;
let isRedisAvailable = false;

export function getRedisClient() {
  if (redisClient) return redisClient;

  if (!env.REDIS_URL) {
    logger.info('REDIS_URL not configured. Operating in persistent DB-backed scheduler mode.');
    return null;
  }

  try {
    redisClient = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis reconnection exceeded limit. Falling back to DB-scheduler.');
          return null; // Stop retrying
        }
        return Math.min(times * 1000, 3000);
      }
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
      isRedisAvailable = true;
    });

    redisClient.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis connection warning; jobs managed persistently in database');
      isRedisAvailable = false;
    });

    redisClient.connect().catch(() => {
      isRedisAvailable = false;
    });

    return redisClient;
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to initialize Redis client');
    return null;
  }
}

export function getCampaignQueue() {
  if (campaignQueue) return campaignQueue;

  const redis = getRedisClient();
  if (!redis || !isRedisAvailable) {
    return null;
  }

  try {
    campaignQueue = new Queue('campaign-jobs', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 100,
        removeOnFail: 500
      }
    });
    return campaignQueue;
  } catch (err) {
    logger.warn({ err }, 'Could not initialize BullMQ campaign queue');
    return null;
  }
}

/**
 * Add a job to the queue, or record persistent schedule in DB if queue is unavailable
 */
export async function scheduleCampaignJob(jobName, payload, options = {}) {
  const queue = getCampaignQueue();
  const delayMs = options.delay || 0;

  if (queue) {
    try {
      const job = await queue.add(jobName, payload, {
        delay: delayMs,
        jobId: options.jobId || `${jobName}-${payload.recipientId}-${payload.reminderNumber || 0}`
      });
      logger.debug({ jobId: job.id, jobName }, 'Enqueued BullMQ job');
      return { id: job.id, enqueued: true };
    } catch (err) {
      logger.warn({ err: err.message, jobName }, 'BullMQ enqueue failed, relying on DB reconciliation');
    }
  }

  // Fallback: Persistent DB record will be picked up by the reconciliation scheduler
  return { id: `db-${Date.now()}`, enqueued: false, scheduledFor: new Date(Date.now() + delayMs) };
}
