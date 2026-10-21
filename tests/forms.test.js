import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { ROLES } from '../src/constants/roles.js';
import { QUESTION_TYPES } from '../src/constants/questionTypes.js';
import { createTestUser, authHeader } from './testHelpers.js';

describe('Feedback Form Management', () => {
  it('should allow an administrator to create a draft feedback form', async () => {
    const { token } = await createTestUser({ role: ROLES.ADMIN });

    const formPayload = {
      title: 'Computer Science Faculty Evaluation',
      description: 'End of semester feedback on instruction quality',
      sections: [
        { id: 's1', title: 'Instruction Delivery', order: 1 }
      ],
      questions: [
        {
          id: 'q1',
          text: 'The instructor explains concepts with great clarity.',
          type: QUESTION_TYPES.LIKERT_SCALE,
          category: 'Teaching Clarity',
          isRequired: true,
          scaleMin: 1,
          scaleMax: 5
        },
        {
          id: 'q2',
          text: 'Rate the timeliness of assignment grading.',
          type: QUESTION_TYPES.NUMERIC_RATING,
          category: 'Assessment',
          isRequired: true,
          scaleMin: 1,
          scaleMax: 5
        },
        {
          id: 'q3',
          text: 'What suggestions do you have for improving this course?',
          type: QUESTION_TYPES.LONG_TEXT,
          category: 'Qualitative',
          isRequired: false
        }
      ]
    };

    const res = await request(app)
      .post('/api/v1/feedback-forms')
      .set(authHeader(token))
      .send(formPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.form.title).toBe('Computer Science Faculty Evaluation');
    expect(res.body.data.form.version).toBe(1);
    expect(res.body.data.form.status).toBe('draft');
    expect(res.body.data.form.questions.length).toBe(3);
  });

  it('should forbid students from creating forms', async () => {
    const { token } = await createTestUser({ role: ROLES.STUDENT });

    const res = await request(app)
      .post('/api/v1/feedback-forms')
      .set(authHeader(token))
      .send({
        title: 'Unauthorized Form',
        questions: [{ text: 'Question 1', type: 'single_choice' }]
      });

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('ROLE_FORBIDDEN');
  });

  it('should reject form with invalid question options for single_choice questions', async () => {
    const { token } = await createTestUser({ role: ROLES.ADMIN });

    const res = await request(app)
      .post('/api/v1/feedback-forms')
      .set(authHeader(token))
      .send({
        title: 'Malformed Form',
        questions: [
          {
            id: 'q_bad',
            text: 'Choose an option',
            type: QUESTION_TYPES.SINGLE_CHOICE,
            options: [] // Invalid: needs at least 2 options
          }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('at least 2 options');
  });

  it('should create a new draft version of an existing form', async () => {
    const { token } = await createTestUser({ role: ROLES.ADMIN });

    // Create v1
    const createRes = await request(app)
      .post('/api/v1/feedback-forms')
      .set(authHeader(token))
      .send({
        title: 'Calculus Course Feedback',
        questions: [
          { id: 'q1', text: 'Instructor punctuality', type: QUESTION_TYPES.LIKERT_SCALE }
        ]
      });

    const formId = createRes.body.data.form._id;

    // Create v2
    const versionRes = await request(app)
      .post(`/api/v1/feedback-forms/${formId}/version`)
      .set(authHeader(token));

    expect(versionRes.status).toBe(201);
    expect(versionRes.body.data.form.version).toBe(2);
    expect(versionRes.body.data.form.status).toBe('draft');
  });
});
