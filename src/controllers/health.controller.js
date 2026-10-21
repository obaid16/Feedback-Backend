import mongoose from 'mongoose';
import { isDatabaseHealthy } from '../config/database.js';
import { sendSuccess } from '../utils/response.js';

export async function healthCheck(req, res) {
  const dbHealthy = isDatabaseHealthy();
  const uptimeSeconds = Math.floor(process.uptime());
  const memoryUsage = process.memoryUsage();

  const isHealthy = dbHealthy;
  const status = isHealthy ? 'healthy' : 'degraded';

  const healthData = {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      server: 'running'
    },
    memory: {
      rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024)
    }
  };

  return res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    statusCode: isHealthy ? 200 : 503,
    data: healthData
  });
}

export function livenessCheck(req, res) {
  return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
