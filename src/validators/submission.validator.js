import { z } from 'zod';

const answerItemSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  ratingValue: z.number().min(1).max(10).optional(),
  textValue: z.string().max(3000).optional(),
  selectedOptions: z.array(z.string()).optional(),
  booleanValue: z.boolean().optional()
});

export const submitFeedbackSchema = z.object({
  answers: z.array(answerItemSchema).min(1, 'At least one answer must be submitted')
});

export const saveDraftSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.any()
  }))
});
