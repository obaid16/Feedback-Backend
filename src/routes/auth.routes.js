import { Router } from 'express';
import {
  getGoogleAuth,
  googleAuthCallback,
  login,
  register,
  getMe,
  logoutUser,
  getCsrf,
  handlePasswordResetRequest,
  handlePasswordResetExecute
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  loginSchema,
  studentRegisterSchema,
  passwordResetRequestSchema,
  passwordResetExecuteSchema,
  googleCallbackQuerySchema
} from '../validators/auth.validator.js';

const router = Router();

// CSRF token generation
router.get('/csrf-token', getCsrf);

// Google OAuth endpoints
router.get('/google', authLimiter, getGoogleAuth);
router.get('/google/callback', authLimiter, validate({ query: googleCallbackQuerySchema }), googleAuthCallback);

// Local authentication endpoints
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/register', authLimiter, validate({ body: studentRegisterSchema }), register);

// Password recovery
router.post('/forgot-password', authLimiter, validate({ body: passwordResetRequestSchema }), handlePasswordResetRequest);
router.post('/reset-password', authLimiter, validate({ body: passwordResetExecuteSchema }), handlePasswordResetExecute);

// Authenticated session management
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logoutUser);

export default router;
