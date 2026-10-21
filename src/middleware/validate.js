import { ValidationError } from '../utils/errors.js';

/**
 * Validate request inputs against Zod schemas
 * @param {Object} schemas - { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 */
export function validate(schemas = {}) {
  return async (req, res, next) => {
    try {
      if (schemas.params) {
        const parsedParams = await schemas.params.safeParseAsync(req.params);
        if (!parsedParams.success) {
          const formatted = parsedParams.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }));
          return next(new ValidationError('Invalid URL parameters', formatted));
        }
        req.params = parsedParams.data;
      }

      if (schemas.query) {
        const parsedQuery = await schemas.query.safeParseAsync(req.query);
        if (!parsedQuery.success) {
          const formatted = parsedQuery.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }));
          return next(new ValidationError('Invalid query parameters', formatted));
        }
        req.query = parsedQuery.data;
      }

      if (schemas.body) {
        const parsedBody = await schemas.body.safeParseAsync(req.body);
        if (!parsedBody.success) {
          const formatted = parsedBody.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }));
          return next(new ValidationError('Invalid request payload', formatted));
        }
        req.body = parsedBody.data;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
