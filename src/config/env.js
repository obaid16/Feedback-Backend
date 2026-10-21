import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  HOST: z.string().default('0.0.0.0'),
  APP_NAME: z.string().default('Faculty Feedback Portal'),

  // Frontend & CORS
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),

  // Database
  MONGODB_URI: z.string().default('mongodb://localhost:27017/faculty_feedback'),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().default(50),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().default(5),

  // Authentication & Session
  JWT_SECRET: z.string().min(16).default('development_jwt_secret_must_be_changed_in_prod'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development_jwt_refresh_secret_must_change'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16).default('development_cookie_secret_at_least_32_chars!'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  ENABLE_PASSWORD_AUTH: z.coerce.boolean().default(true),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:5000/api/v1/auth/google/callback'),
  ALLOWED_EMAIL_DOMAINS: z.string().optional().default(''), // comma-separated, e.g. "university.edu,college.edu"

  // OpenAI
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(2500),
  OPENAI_TEMPERATURE: z.coerce.number().default(0.2),

  // Email
  EMAIL_HOST: z.string().default('smtp.mailtrap.io'),
  EMAIL_PORT: z.coerce.number().default(2525),
  EMAIL_SECURE: z.coerce.boolean().default(false),
  EMAIL_USER: z.string().optional().default(''),
  EMAIL_PASSWORD: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Faculty Intelligence Portal <noreply@institution.edu>'),
  EMAIL_REPLY_TO: z.string().default('support@institution.edu'),
  EMAIL_MOCK_ENABLED: z.coerce.boolean().default(true),

  // Redis & Queue
  REDIS_URL: z.string().optional().default('redis://127.0.0.1:6379'),
  QUEUE_CONCURRENCY: z.coerce.number().default(5),

  // Reminders & Policies
  DEFAULT_TIMEZONE: z.string().default('UTC'),
  REMINDER_SCHEDULE_HOURS_1: z.coerce.number().default(48),
  REMINDER_SCHEDULE_HOURS_2: z.coerce.number().default(96),
  ESCALATION_SCHEDULE_HOURS: z.coerce.number().default(120),
  SCHEDULER_RECONCILIATION_INTERVAL_MS: z.coerce.number().default(300000), // 5 minutes

  // AI Reports & Anonymity
  MIN_REPORT_RESPONSES: z.coerce.number().default(5),
  REPORT_STORAGE_PATH: z.string().default('./storage/reports'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export const env = parsed.success ? parsed.data : envSchema.parse({});

// Helper for allowed origins array
export const allowedOriginsList = env.ALLOWED_ORIGINS
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Helper for allowed email domains array
export const allowedEmailDomainsList = env.ALLOWED_EMAIL_DOMAINS
  ? env.ALLOWED_EMAIL_DOMAINS.split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
  : [];
