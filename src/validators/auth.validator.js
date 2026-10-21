import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid institutional email is required').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100)
});

export const studentRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Valid institutional email is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  studentId: z.string().min(2).max(50).optional(),
  department: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID').optional(),
  cohort: z.string().max(50).optional()
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email('Valid email is required')
});

export const passwordResetExecuteSchema = z.object({
  token: z.string().min(10, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

export const googleCallbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'OAuth state is required')
});
