import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { env, allowedEmailDomainsList } from '../config/env.js';
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashToken,
  generatePKCE,
  safeCompare
} from '../utils/crypto.js';
import { setCsrfCookie } from '../middleware/csrf.js';
import { sendPasswordReset } from './email/email.service.js';
import { logAuditEvent } from './audit.service.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError
} from '../utils/errors.js';
import { normalizeEmail } from '../utils/sanitization.js';
import { logger } from '../config/logger.js';

let googleClient = null;

function getGoogleClient() {
  if (googleClient) return googleClient;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth credentials not configured.');
    return null;
  }
  googleClient = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL
  );
  return googleClient;
}

/**
 * Generate Google OAuth authorization URL with state and PKCE
 */
export function generateGoogleAuthUrl() {
  const client = getGoogleClient();
  if (!client) {
    throw new BadRequestError('Google OAuth is not configured on this server.');
  }

  const state = generateRandomToken(32, 'hex');
  const { verifier, challenge } = generatePKCE();

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account'
  });

  return { authUrl, state, verifier };
}

/**
 * Exchange Google OAuth code for user identity and provision/link account
 */
export async function handleGoogleCallback({ code, state, storedState, codeVerifier, reqMeta = {} }) {
  const client = getGoogleClient();
  if (!client) {
    throw new BadRequestError('Google OAuth is not configured.');
  }

  // Validate OAuth state
  if (!state || !storedState || !safeCompare(state, storedState)) {
    throw new UnauthorizedError('OAuth state mismatch. Request may have been tampered with.', 'INVALID_OAUTH_STATE');
  }

  let tokens;
  try {
    const tokenRes = await client.getToken({
      code,
      codeVerifier
    });
    tokens = tokenRes.tokens;
  } catch (err) {
    logger.error({ err: err.message }, 'Google OAuth token exchange failed');
    throw new UnauthorizedError('Failed to exchange authorization code with Google.', 'OAUTH_CODE_EXCHANGE_FAILED');
  }

  // Verify ID token
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email_verified) {
    throw new UnauthorizedError('Google email account is unverified.', 'UNVERIFIED_EMAIL');
  }

  const googleId = payload.sub;
  const email = normalizeEmail(payload.email);
  const name = payload.name || payload.email.split('@')[0];
  const domain = payload.hd || email.split('@')[1];

  // Institutional domain enforcement if configured
  if (allowedEmailDomainsList.length > 0 && !allowedEmailDomainsList.includes(domain)) {
    throw new ForbiddenError(
      `Access restricted to institutional email domains: ${allowedEmailDomainsList.join(', ')}`,
      'DOMAIN_RESTRICTED'
    );
  }

  // Account lookup and linking
  let user = await User.findOne({
    $or: [{ googleId }, { email }]
  }).select('+tokenVersion +status');

  if (user) {
    if (user.status !== 'active') {
      throw new ForbiddenError(`Your account is ${user.status}. Please contact an administrator.`);
    }

    // Link Google ID if registered previously via local password
    if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = user.authProvider === 'local' ? 'both' : 'google';
    }
    user.lastLoginAt = new Date();
    await user.save();
  } else {
    // Provision new Student account (Never automatically provision Admin accounts!)
    user = await User.create({
      name,
      email,
      googleId,
      authProvider: 'google',
      role: ROLES.STUDENT,
      status: 'active',
      lastLoginAt: new Date()
    });
  }

  await logAuditEvent({
    actor: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'auth:google_login',
    resourceType: 'User',
    resourceId: user._id,
    requestId: reqMeta.requestId,
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent
  });

  const token = generateAuthToken(user);
  return { user, token };
}

/**
 * Local email/password login
 */
export async function loginWithPassword({ email, password, reqMeta = {} }) {
  if (!env.ENABLE_PASSWORD_AUTH) {
    throw new BadRequestError('Password authentication is disabled by institutional policy.');
  }

  const normalized = normalizeEmail(email);
  const user = await User.findOne({ email: normalized }).select('+passwordHash +tokenVersion +status');

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'active') {
    throw new ForbiddenError(`Account is ${user.status}. Contact support.`);
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();

  await logAuditEvent({
    actor: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'auth:local_login',
    resourceType: 'User',
    resourceId: user._id,
    requestId: reqMeta.requestId,
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent
  });

  const token = generateAuthToken(user);
  return { user, token };
}

/**
 * Self-registration for students only
 */
export async function registerStudent({ name, email, password, studentId, department, cohort, reqMeta = {} }) {
  if (!env.ENABLE_PASSWORD_AUTH) {
    throw new BadRequestError('Password registration is disabled by institutional policy.');
  }

  const normalized = normalizeEmail(email);

  // Enforce institutional domain restriction if set
  if (allowedEmailDomainsList.length > 0) {
    const domain = normalized.split('@')[1];
    if (!allowedEmailDomainsList.includes(domain)) {
      throw new ForbiddenError(
        `Registration restricted to institutional email domains: ${allowedEmailDomainsList.join(', ')}`
      );
    }
  }

  const existing = await User.findOne({ email: normalized });
  if (existing) {
    throw new ConflictError('An account with this email address already exists.');
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name,
    email: normalized,
    passwordHash,
    authProvider: 'local',
    role: ROLES.STUDENT, // Strictly STUDENT role
    status: 'active',
    studentId,
    department: department || null,
    cohort: cohort || null,
    lastLoginAt: new Date()
  });

  await logAuditEvent({
    actor: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'auth:student_register',
    resourceType: 'User',
    resourceId: user._id,
    requestId: reqMeta.requestId,
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent
  });

  const token = generateAuthToken(user);
  return { user, token };
}

/**
 * Request password reset email
 */
export async function requestPasswordReset(email) {
  const normalized = normalizeEmail(email);
  const user = await User.findOne({ email: normalized });

  // Always return success even if user not found to prevent user enumeration attacks
  if (!user) {
    return { success: true };
  }

  const rawResetToken = generateRandomToken(32, 'hex');
  const tokenHash = hashToken(rawResetToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpiresAt = expiresAt;
  await user.save();

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawResetToken}`;
  await sendPasswordReset({
    userEmail: user.email,
    userName: user.name,
    resetUrl
  });

  return { success: true };
}

/**
 * Execute password reset using short-lived single-use token
 */
export async function resetPassword({ token, newPassword, reqMeta = {} }) {
  if (!token) throw new BadRequestError('Reset token is required');

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpiresAt: { $gt: new Date() }
  }).select('+resetPasswordTokenHash +resetPasswordExpiresAt +tokenVersion');

  if (!user) {
    throw new BadRequestError('Reset token is invalid or has expired.');
  }

  const newHash = await hashPassword(newPassword);
  user.passwordHash = newHash;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpiresAt = undefined;
  // Invalidate all active sessions
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  await logAuditEvent({
    actor: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'auth:password_reset_success',
    resourceType: 'User',
    resourceId: user._id,
    requestId: reqMeta.requestId,
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent
  });

  return { success: true };
}

/**
 * Generate signed JWT
 */
export function generateAuthToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Set secure auth cookies
 */
export function setAuthCookies(res, token) {
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });

  setCsrfCookie(res);
}

/**
 * Clear auth cookies and revoke session
 */
export async function logout(res, userId = null) {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: '/'
  });

  res.clearCookie('csrf_token', {
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    path: '/'
  });

  if (userId) {
    // Invalidate user token version in database
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  }

  return { success: true };
}
