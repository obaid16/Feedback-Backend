import { z } from 'zod';
import { ALL_QUESTION_TYPES } from '../constants/questionTypes.js';

const questionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(3).max(500),
  type: z.enum(ALL_QUESTION_TYPES),
  category: z.string().optional().default('General'),
  isRequired: z.boolean().optional().default(true),
  order: z.number().optional().default(0),
  options: z.array(z.object({
    label: z.string().min(1),
    value: z.union([z.string(), z.number()]),
    score: z.number().optional()
  })).optional(),
  scaleMin: z.number().optional().default(1),
  scaleMax: z.number().optional().default(5),
  scaleLabels: z.object({
    min: z.string().optional(),
    max: z.string().optional()
  }) .optional()
});

const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  order: z.number().optional().default(0)
});

export const createFormSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().max(1000).optional(),
  sections: z.array(sectionSchema).optional().default([]),
  questions: z.array(questionSchema).min(1, 'Form must contain at least 1 question')
});

export const updateFormSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  description: z.string().max(1000).optional(),
  sections: z.array(sectionSchema).optional(),
  questions: z.array(questionSchema).optional()
});

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string()).min(1, 'Array of question IDs is required')
});
