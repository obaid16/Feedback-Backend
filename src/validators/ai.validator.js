import { z } from 'zod';
import { ALL_QUESTION_TYPES } from '../constants/questionTypes.js';

export const generateFormAiSchema = z.object({
  purpose: z.string().min(3).max(300).optional().default('Comprehensive Faculty Evaluation'),
  departmentName: z.string().max(100).optional().default('General Academics'),
  courseName: z.string().max(100).optional().default('General Course'),
  facultyName: z.string().max(100).optional().default('Assigned Faculty'),
  audience: z.string().max(100).optional().default('Undergraduate Students'),
  questionCount: z.coerce.number().min(3).max(15).optional().default(7),
  desiredTypes: z.array(z.enum(ALL_QUESTION_TYPES)).optional(),
  tone: z.string().max(100).optional().default('constructive and professional'),
  institutionalRequirements: z.string().max(500).optional()
});

export const generateReportAiSchema = z.object({
  campaignId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid campaign ID'),
  facultyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid faculty profile ID'),
  reportingPeriod: z.string().min(2).max(100).optional().default('Current Term')
});
