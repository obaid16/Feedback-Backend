import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export async function authenticate(req, res, next) {
  try {
    let token = null;

    // Check HttpOnly cookie first
    if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required. No token provided.', 'NO_TOKEN');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Session expired. Please log in again.', 'TOKEN_EXPIRED');
      }
      throw new UnauthorizedError('Invalid authentication token.', 'INVALID_TOKEN');
    }

    const user = await User.findById(decoded.userId).select('+status +tokenVersion');
    if (!user) {
      throw new UnauthorizedError('Account not found.', 'USER_NOT_FOUND');
    }

    if (user.status !== 'active') {
      throw new ForbiddenError(`Account is ${user.status}. Please contact an administrator.`, 'ACCOUNT_DISABLED');
    }

    // Check token version to handle administrative revocation or explicit logout
    if (typeof decoded.tokenVersion === 'number' && decoded.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedError('Session has been revoked. Please log in again.', 'SESSION_REVOKED');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(req, res, next) {
  try {
    let token = null;
    if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('+status +tokenVersion');
    if (user && user.status === 'active' && decoded.tokenVersion === user.tokenVersion) {
      req.user = user;
    }
    next();
  } catch {
    // If token verification fails, continue as unauthenticated
    next();
  }
}
