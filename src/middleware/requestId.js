import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && incomingId.trim()) ? incomingId.trim() : uuidv4();
  
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
