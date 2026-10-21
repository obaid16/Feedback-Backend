import pino from 'pino';
import { env } from './env.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'password',
      'passwordHash',
      'resetPasswordToken',
      'token',
      'refreshToken',
      'accessToken',
      'secret',
      'apiKey',
      'OPENAI_API_KEY',
      'answers',
      'rawFeedback',
      'studentEmail',
      'studentId'
    ],
    censor: '[REDACTED]'
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  base: {
    service: 'faculty-feedback-backend',
    env: env.NODE_ENV
  }
});
