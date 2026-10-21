import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { hasPermission } from '../constants/permissions.js';

/**
 * Restrict endpoint access to specific roles
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Requires one of the following roles: ${roles.join(', ')}`,
          'ROLE_FORBIDDEN'
        )
      );
    }

    next();
  };
}

/**
 * Restrict endpoint access to users possessing explicit permissions
 */
export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const hasAll = permissions.every(p =>
      hasPermission(req.user.role, p, req.user.customPermissions)
    );

    if (!hasAll) {
      return next(
        new ForbiddenError(
          `Insufficient permissions. Missing required permission: ${permissions.join(', ')}`,
          'INSUFFICIENT_PERMISSIONS'
        )
      );
    }

    next();
  };
}
