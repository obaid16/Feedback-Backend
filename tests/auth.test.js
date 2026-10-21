import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { ROLES } from '../src/constants/roles.js';
import { createTestUser, authHeader } from './testHelpers.js';

describe('Authentication & Account Security', () => {
  it('should authenticate user with valid email and password', async () => {
    const { user } = await createTestUser({ email: 'student1@university.edu' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'student1@university.edu',
        password: 'SecurePass123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('student1@university.edu');
    expect(res.body.data.token).toBeDefined();
    // Cookie should be set
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should reject login with incorrect password', async () => {
    await createTestUser({ email: 'student2@university.edu' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'student2@university.edu',
        password: 'WrongPassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('should reject login for disabled accounts', async () => {
    await createTestUser({ email: 'disabled@university.edu', status: 'disabled' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'disabled@university.edu',
        password: 'SecurePass123!'
      });

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('should allow student registration but never grant administrator role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'New Student',
        email: 'newstudent@university.edu',
        password: 'Password123!',
        studentId: 'STU-9999',
        role: 'admin' // Attempting privilege escalation
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // Role MUST remain student
    expect(res.body.data.user.role).toBe(ROLES.STUDENT);
  });

  it('should fetch current authenticated user profile via /auth/me', async () => {
    const { user, token } = await createTestUser();

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
  });

  it('should revoke access when session is logged out or tokenVersion incremented', async () => {
    const { user, token } = await createTestUser();

    // Invalidate session
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token));

    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('SESSION_REVOKED');
  });

  it('should reject invalid OAuth state during Google callback', async () => {
    const res = await request(app)
      .get('/api/v1/auth/google/callback?code=mock_code&state=forged_state')
      .set('Cookie', ['oauth_state=legitimate_state']);

    // Callback redirects to frontend with error parameter
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('status=error');
  });
});
