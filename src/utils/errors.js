export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', errorCode = 'BAD_REQUEST', details = null) {
    super(message, 400, errorCode, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Failed', details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication Required', errorCode = 'UNAUTHORIZED', details = null) {
    super(message, 401, errorCode, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden Resource Access', errorCode = 'FORBIDDEN', details = null) {
    super(message, 403, errorCode, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found', errorCode = 'NOT_FOUND', details = null) {
    super(message, 404, errorCode, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource Conflict', errorCode = 'CONFLICT', details = null) {
    super(message, 409, errorCode, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests, please slow down', errorCode = 'RATE_LIMIT_EXCEEDED', details = null) {
    super(message, 429, errorCode, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Temporarily Unavailable', errorCode = 'SERVICE_UNAVAILABLE', details = null) {
    super(message, 503, errorCode, details);
  }
}
