import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  // If response has already started streaming, delegate to default express handler
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Handle Mongoose / MongoDB specific errors
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID_FORMAT';
    message = `Invalid format for resource identifier '${err.value}'`;
    details = [{ path: err.path, value: err.value }];
  } else if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_RESOURCE';
    const fields = Object.keys(err.keyPattern || {});
    message = `A resource with the specified ${fields.join(', ')} already exists.`;
    details = err.keyValue;
  } else if (err.name === 'ValidationError' && !err.isOperational) {
    statusCode = 422;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed on resource schema';
    details = Object.values(err.errors || {}).map(e => ({
      field: e.path,
      message: e.message
    }));
  } else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'MALFORMED_JSON';
    message = 'Request body contains invalid JSON syntax.';
  }

  // Log error based on severity
  const isOperational = err.isOperational || statusCode < 500;
  const logData = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    errorCode,
    message: err.message,
    stack: isOperational ? undefined : err.stack
  };

  if (isOperational) {
    logger.warn(logData, `Operational error: ${message}`);
  } else {
    logger.error(logData, `Unhandled server exception: ${message}`);
  }

  // Hide details and internal messages in production for 500 errors
  if (env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'An internal server error occurred. Please contact system support.';
    details = null;
  }

  return sendError(res, {
    statusCode,
    errorCode,
    message,
    details
  });
}
