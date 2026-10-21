import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';

let mongoServer = null;

beforeAll(async () => {
  // Set test environment flags
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_with_sufficient_length_for_hmac_signing';
  process.env.COOKIE_SECRET = 'test_cookie_secret_with_sufficient_length';
  process.env.EMAIL_MOCK_ENABLED = 'true';
  process.env.MIN_REPORT_RESPONSES = '3'; // Lowered threshold for test suites

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri);
});

beforeEach(async () => {
  // Clean all collections between tests to guarantee state isolation
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});
