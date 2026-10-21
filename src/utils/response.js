/**
 * Standard API response helper functions
 */

export function sendSuccess(res, data = null, message = 'Success', statusCode = 200, meta = {}) {
  const requestId = res.req?.requestId || res.getHeader('X-Request-Id');
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...meta
    }
  });
}

export function sendPaginated(res, items = [], pagination = {}, message = 'Data retrieved successfully') {
  const { page = 1, limit = 20, total = 0 } = pagination;
  const totalPages = Math.ceil(total / limit) || 1;

  return sendSuccess(res, items, message, 200, {
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  });
}

export function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  const errorCode = error.errorCode || 'INTERNAL_SERVER_ERROR';
  const message = error.message || 'An unexpected error occurred';
  const details = error.details || null;
  const requestId = res.req?.requestId || res.getHeader('X-Request-Id');

  return res.status(statusCode).json({
    success: false,
    statusCode,
    errorCode,
    message,
    details,
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  });
}
