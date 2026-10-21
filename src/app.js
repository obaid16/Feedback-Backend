import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, allowedOriginsList } from './config/env.js';
import { logger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/errors.js';
import apiV1Router from './routes/index.js';

export function createApp() {
  const app = express();

  // Trust proxy for reverse proxies / render / heroku / nginx
  app.set('trust proxy', 1);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Managed by Next.js frontend
      crossOriginEmbedderPolicy: false
    })
  );

  // Strict CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        if (allowedOriginsList.includes(origin) || env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-CSRF-Token', 'X-XSRF-Token'],
      exposedHeaders: ['X-Request-Id']
    })
  );

  // Request correlation identifier
  app.use(requestIdMiddleware);

  // Body parsers with bounded payload limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Cookie parsing with signing secret
  app.use(cookieParser(env.COOKIE_SECRET));

  // Request logging
  app.use((req, res, next) => {
    logger.debug({ method: req.method, url: req.originalUrl, requestId: req.requestId }, 'Incoming request');
    next();
  });

  // General rate limiter
  app.use('/api/', apiLimiter);

  // CSRF validation for state-changing cookie-authenticated requests
  app.use('/api/', csrfProtection);

  // Mount API v1
  app.use('/api/v1', apiV1Router);

  // Handle 404 for undefined routes
  app.use((req, res, next) => {
    next(new NotFoundError(`Resource not found: ${req.method} ${req.originalUrl}`));
  });

  // Central error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
