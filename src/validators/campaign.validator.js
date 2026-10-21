import { z } from 'zod';
import { ALL_ANONYMITY_MODES } from '../constants/campaignStatus.js';

export const createCampaignSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().max(2000).optional(),
  purpose: z.string().max(200).optional(),
  formId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid form ID'),
  targetDepartment: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID').optional(),
  targetCourse: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid course ID').optional(),
  targetFaculty: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid faculty profile ID').optional(),
  audience: z.object({
    cohorts: z.array(z.string()).optional(),
    departments: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    courses: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    explicitStudents: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional()
  }).optional(),
  startDate: z.string().datetime({ message: 'Valid ISO startDate required' }),
  deadline: z.string().datetime({ message: 'Valid ISO deadline required' }),
  anonymity: z.object({
    mode: z.enum(ALL_ANONYMITY_MODES).optional(),
    disclosedPolicy: z.string().max(500).optional(),
    minResponsesForReport: z.number().min(1).max(100).optional()
  }).optional(),
  reminders: z.object({
    enabled: z.boolean().optional(),
    firstReminderHours: z.number().min(1).optional(),
    secondReminderHours: z.number().min(2).optional(),
    adminEscalationHours: z.number().min(3).optional()
  }).optional()
});

export const updateCampaignSchema = createCampaignSchema.partial();
