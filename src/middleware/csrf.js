import { ForbiddenError } from '../utils/errors.js';
import { safeCompare, generateRandomToken } from '../utils/crypto.js';
import { env } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generate and set CSRF cookie
 */
export function setCsrfCookie(res) {
  const token = generateRandomToken(24, 'hex');
  res.cookie('csrf_token', token, {
    httpOnly: false, // Accessible to JavaScript so the frontend can read and send in x-csrf-token header
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: '/'
  });
  return token;
}

/**
 * CSRF Protection Middleware for state-changing cookie-authenticated requests
 */
export function csrfProtection(req, res, next) {
  // Safe HTTP methods do not mutate state
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // If the request is authenticating via Authorization: Bearer, standard CORS prevents CSRF
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') && !req.cookies?.access_token) {
    return next();
  }

  // If request has cookie authentication, enforce CSRF token check
  if (req.cookies && req.cookies.access_token) {
    const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    const cookieToken = req.cookies.csrf_token;

    if (!headerToken || !cookieToken || !safeCompare(headerToken, cookieToken)) {
      return next(
        new ForbiddenError(
          'CSRF token validation failed. Please provide a matching x-csrf-token header.',
          'CSRF_TOKEN_INVALID'
        )
      );
    }
  }

  next();
}
