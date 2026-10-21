import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getOpenAIClient } from './openai.client.js';
import { ALL_QUESTION_TYPES, QUESTION_TYPES } from '../../constants/questionTypes.js';
import { sanitizeForAiPrompt } from '../../utils/sanitization.js';
import { AppError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const generatedQuestionSchema = z.object({
  id: z.string().default(() => uuidv4()),
  text: z.string().min(5).max(500),
  type: z.enum(ALL_QUESTION_TYPES),
  category: z.string().default('General'),
  isRequired: z.boolean().default(true),
  order: z.number().default(0),
  options: z.array(z.object({
    label: z.string(),
    value: z.union([z.string(), z.number()]),
    score: z.number().optional()
  })).optional().default([]),
  scaleMin: z.number().optional().default(1),
  scaleMax: z.number().optional().default(5),
  scaleLabels: z.object({
    min: z.string().default('Strongly Disagree'),
    max: z.string().default('Strongly Agree')
  }).optional()
});

const generatedFormSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().max(1000),
  sections: z.array(z.object({
    id: z.string().default(() => uuidv4()),
    title: z.string(),
    description: z.string().optional(),
    order: z.number().default(0)
  })).optional().default([]),
  questions: z.array(generatedQuestionSchema).min(1)
});

/**
 * Generate a validated draft feedback form using OpenAI
 */
export async function generateFeedbackFormWithAI({
  purpose = 'Comprehensive Course and Faculty Evaluation',
  departmentName = 'General Academics',
  courseName = 'General Course',
  facultyName = 'Assigned Faculty',
  audience = 'Enrolled Undergraduate Students',
  questionCount = 8,
  desiredTypes = [QUESTION_TYPES.LIKERT_SCALE, QUESTION_TYPES.NUMERIC_RATING, QUESTION_TYPES.LONG_TEXT],
  tone = 'constructive and professional',
  institutionalRequirements = ''
}) {
  const client = getOpenAIClient();

  // Bounded and sanitized inputs
  const safePurpose = sanitizeForAiPrompt(purpose, 200);
  const safeDept = sanitizeForAiPrompt(departmentName, 100);
  const safeCourse = sanitizeForAiPrompt(courseName, 100);
  const safeFaculty = sanitizeForAiPrompt(facultyName, 100);
  const safeReqs = sanitizeForAiPrompt(institutionalRequirements, 300);

  const systemPrompt = `You are an expert higher education psychometrician, curriculum evaluator, and academic quality assurance architect.
Your role is to draft a balanced, objective, and constructive faculty feedback evaluation form.
CRITICAL EVALUATION GUIDELINES:
1. Cover core academic dimensions:
   - Teaching clarity & explanation depth
   - Subject mastery & intellectual engagement
   - Classroom interaction & responsiveness
   - Availability during office hours & mentorship
   - Assessment fairness, rubric transparency, & timeliness of feedback
   - Learning environment inclusivity & respect
2. AVOID leading, biased, repetitive, or double-barrelled questions.
3. NEVER ask for student personal identity or sensitive demographic questions.
4. Return ONLY valid JSON adhering strictly to the requested schema. No conversational filler.
5. All Likert scale questions must use scaleMin: 1, scaleMax: 5.`;

  const userPrompt = `Draft an institutional feedback form:
- Purpose: ${safePurpose}
- Department: ${safeDept}
- Course: ${safeCourse}
- Faculty: ${safeFaculty}
- Target Audience: ${audience}
- Number of Questions: ${Math.min(Math.max(questionCount, 3), 15)}
- Permitted Question Types: ${desiredTypes.join(', ')}
- Tone: ${tone}
${safeReqs ? `- Institutional Notes: ${safeReqs}` : ''}

JSON Output Format:
{
  "title": "string",
  "description": "string",
  "sections": [{ "id": "s1", "title": "Section Name", "description": "...", "order": 0 }],
  "questions": [
    {
      "id": "q1",
      "text": "The instructor clearly articulated learning objectives at the beginning of lectures.",
      "type": "likert_scale",
      "category": "Teaching Clarity",
      "isRequired": true,
      "order": 1,
      "scaleMin": 1,
      "scaleMax": 5,
      "scaleLabels": { "min": "Strongly Disagree", "max": "Strongly Agree" }
    }
  ]
}`;

  if (!client) {
    logger.info('No OpenAI client initialized. Returning standard institutional draft form.');
    return getFallbackDraftForm({ purpose: safePurpose, courseName: safeCourse, facultyName: safeFaculty, questionCount });
  }

  try {
    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: env.OPENAI_MAX_TOKENS,
      temperature: env.OPENAI_TEMPERATURE
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new AppError('Empty response received from OpenAI', 502, 'AI_EMPTY_RESPONSE');
    }

    const parsedJson = JSON.parse(content);
    const validated = generatedFormSchema.parse(parsedJson);

    // Assign sequential order and unique IDs
    validated.questions.forEach((q, idx) => {
      q.id = `q_${idx + 1}_${Date.now().toString(36)}`;
      q.order = idx + 1;
    });

    return validated;
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to generate form via OpenAI');
    if (err instanceof z.ZodError) {
      throw new AppError('AI generated questions failed schema validation', 502, 'AI_SCHEMA_MISMATCH', err.errors);
    }
    // Return structured fallback if transient provider failure occurs
    return getFallbackDraftForm({ purpose: safePurpose, courseName: safeCourse, facultyName: safeFaculty, questionCount });
  }
}

/**
 * High-quality fallback template adhering to the exact same schema
 */
function getFallbackDraftForm({ purpose, courseName, facultyName, questionCount = 7 }) {
  return {
    title: `${courseName} — Faculty Teaching Evaluation`,
    description: `Constructive student feedback regarding ${facultyName}'s instruction for ${courseName}. Purpose: ${purpose}.`,
    sections: [
      { id: 'sec_1', title: 'Instruction & Pedagogy', description: 'Evaluation of teaching methodology and clarity', order: 1 },
      { id: 'sec_2', title: 'Assessment & Feedback', description: 'Transparency and quality of grading', order: 2 },
      { id: 'sec_3', title: 'Open Reflections', description: 'Qualitative comments', order: 3 }
    ],
    questions: [
      {
        id: `q_1_${Date.now().toString(36)}`,
        text: 'The instructor explains complex concepts clearly and effectively.',
        type: QUESTION_TYPES.LIKERT_SCALE,
        category: 'Teaching Clarity',
        isRequired: true,
        order: 1,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { min: 'Strongly Disagree', max: 'Strongly Agree' },
        options: []
      },
      {
        id: `q_2_${Date.now().toString(36)}`,
        text: 'The instructor demonstrates in-depth mastery of the subject matter.',
        type: QUESTION_TYPES.LIKERT_SCALE,
        category: 'Subject Mastery',
        isRequired: true,
        order: 2,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { min: 'Strongly Disagree', max: 'Strongly Agree' },
        options: []
      },
      {
        id: `q_3_${Date.now().toString(36)}`,
        text: 'The instructor creates an engaging and interactive classroom atmosphere.',
        type: QUESTION_TYPES.LIKERT_SCALE,
        category: 'Engagement',
        isRequired: true,
        order: 3,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { min: 'Strongly Disagree', max: 'Strongly Agree' },
        options: []
      },
      {
        id: `q_4_${Date.now().toString(36)}`,
        text: 'The instructor is accessible during office hours and responsive to student inquiries.',
        type: QUESTION_TYPES.LIKERT_SCALE,
        category: 'Availability',
        isRequired: true,
        order: 4,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { min: 'Strongly Disagree', max: 'Strongly Agree' },
        options: []
      },
      {
        id: `q_5_${Date.now().toString(36)}`,
        text: 'Evaluation criteria and grading rubrics were clearly communicated and fairly applied.',
        type: QUESTION_TYPES.LIKERT_SCALE,
        category: 'Assessment Fairness',
        isRequired: true,
        order: 5,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: { min: 'Strongly Disagree', max: 'Strongly Agree' },
        options: []
      },
      {
        id: `q_6_${Date.now().toString(36)}`,
        text: 'Rate the overall effectiveness of this instructor on a scale of 1 to 5.',
        type: QUESTION_TYPES.NUMERIC_RATING,
        category: 'Overall Rating',
        isRequired: true,
        order: 6,
        scaleMin: 1,
        scaleMax: 5,
        options: []
      },
      {
        id: `q_7_${Date.now().toString(36)}`,
        text: 'What are the greatest strengths of this instructor, and what constructive suggestions do you have for improvement?',
        type: QUESTION_TYPES.LONG_TEXT,
        category: 'Qualitative',
        isRequired: false,
        order: 7,
        options: []
      }
    ].slice(0, questionCount)
  };
}
