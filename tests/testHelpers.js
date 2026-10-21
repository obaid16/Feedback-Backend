import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { ROLES } from '../src/constants/roles.js';
import { hashPassword, generateRandomToken } from '../src/utils/crypto.js';
import { generateAuthToken } from '../src/services/auth.service.js';

export async function createTestUser({
  name = 'Test User',
  email = null,
  role = ROLES.STUDENT,
  status = 'active',
  studentId = 'STU-1001',
  department = null
} = {}) {
  const randomEmail = email || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@university.edu`;
  const passwordHash = await hashPassword('SecurePass123!');

  const user = await User.create({
    name,
    email: randomEmail,
    passwordHash,
    role,
    status,
    studentId,
    department,
    authProvider: 'local',
    tokenVersion: 0
  });

  const token = generateAuthToken(user);
  return { user, token };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
