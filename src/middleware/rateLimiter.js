import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { TooManyRequestsError } from '../utils/errors.js';

// Relax rate limiting in development or test environment
const isRelaxed = env.NODE_ENV === 'test' || env.NODE_ENV === 'development';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isRelaxed ? 50000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new TooManyRequestsError('General rate limit exceeded. Please try again later.'));
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isRelaxed ? 10000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new TooManyRequestsError('Too many authentication attempts. Please try again in 15 minutes.'));
  }
});

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isRelaxed ? 10000 : 25,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new TooManyRequestsError('AI generation rate limit reached. Please wait before generating more forms or reports.'));
  }
});

export const submissionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: isRelaxed ? 10000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new TooManyRequestsError('Too many submission attempts. Please slow down.'));
  }
});
