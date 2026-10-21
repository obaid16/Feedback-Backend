import {
  generateGoogleAuthUrl,
  handleGoogleCallback,
  loginWithPassword,
  registerStudent,
  requestPasswordReset,
  resetPassword,
  setAuthCookies,
  logout
} from '../services/auth.service.js';
import { setCsrfCookie } from '../middleware/csrf.js';
import { sendSuccess } from '../utils/response.js';
import { env } from '../config/env.js';

export async function getGoogleAuth(req, res, next) {
  try {
    const { authUrl, state, verifier } = generateGoogleAuthUrl();

    // Store state and PKCE verifier in short-lived secure cookies for verification on callback
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000 // 10 minutes
    });

    res.cookie('oauth_verifier', verifier, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000
    });

    return res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
}

export async function googleAuthCallback(req, res, next) {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies.oauth_state;
    const codeVerifier = req.cookies.oauth_verifier;

    const { user, token } = await handleGoogleCallback({
      code,
      state,
      storedState,
      codeVerifier,
      reqMeta: {
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Clear temporary oauth state cookies
    res.clearCookie('oauth_state');
    res.clearCookie('oauth_verifier');

    // Set authenticated session cookies
    setAuthCookies(res, token);

    // Redirect safely to validated frontend URL (prevents open redirect)
    return res.redirect(`${env.FRONTEND_URL}/auth/callback?status=success`);
  } catch (err) {
    // Redirect to frontend with safe error parameter
    res.clearCookie('oauth_state');
    res.clearCookie('oauth_verifier');
    return res.redirect(`${env.FRONTEND_URL}/auth/callback?status=error&message=${encodeURIComponent(err.message)}`);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, token } = await loginWithPassword({
      email,
      password,
      reqMeta: {
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    setAuthCookies(res, token);
    return sendSuccess(res, { user, token }, 'Logged in successfully');
  } catch (err) {
    next(err);
  }
}

export async function register(req, res, next) {
  try {
    const { name, email, password, studentId, department, cohort } = req.body;
    const { user, token } = await registerStudent({
      name,
      email,
      password,
      studentId,
      department,
      cohort,
      reqMeta: {
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    setAuthCookies(res, token);
    return sendSuccess(res, { user, token }, 'Student account registered successfully', 201);
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    return sendSuccess(res, { user: req.user }, 'Current user profile');
  } catch (err) {
    next(err);
  }
}

export async function logoutUser(req, res, next) {
  try {
    await logout(res, req.user?._id);
    return sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

export async function getCsrf(req, res) {
  const token = setCsrfCookie(res);
  return sendSuccess(res, { csrfToken: token }, 'CSRF token initialized');
}

export async function handlePasswordResetRequest(req, res, next) {
  try {
    const { email } = req.body;
    await requestPasswordReset(email);
    return sendSuccess(res, null, 'If this account exists, a password reset link has been dispatched to your email.');
  } catch (err) {
    next(err);
  }
}

export async function handlePasswordResetExecute(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    await resetPassword({
      token,
      newPassword,
      reqMeta: {
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    return sendSuccess(res, null, 'Password reset successfully. You may now log in with your new password.');
  } catch (err) {
    next(err);
  }
}
