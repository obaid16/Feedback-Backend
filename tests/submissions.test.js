import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { ROLES } from '../src/constants/roles.js';
import { QUESTION_TYPES } from '../src/constants/questionTypes.js';
import { FeedbackForm } from '../src/models/FeedbackForm.js';
import { FeedbackCampaign } from '../src/models/FeedbackCampaign.js';
import { CampaignRecipient } from '../src/models/CampaignRecipient.js';
import { FeedbackSubmission } from '../src/models/FeedbackSubmission.js';
import { createTestUser, authHeader } from './testHelpers.js';

describe('Feedback Submission & Anonymity Architecture', () => {
  let adminToken, studentUser, studentToken, form, campaign;

  beforeEach(async () => {
    const admin = await createTestUser({ role: ROLES.ADMIN, email: 'admin@uni.edu' });
    adminToken = admin.token;

    const student = await createTestUser({ role: ROLES.STUDENT, email: 'student@uni.edu' });
    studentUser = student.user;
    studentToken = student.token;

    // Create Form
    form = await FeedbackForm.create({
      title: 'Operating Systems Evaluation',
      version: 1,
      status: 'published',
      questions: [
        {
          id: 'q1',
          text: 'The instructor explains OS algorithms clearly.',
          type: QUESTION_TYPES.LIKERT_SCALE,
          category: 'Teaching Clarity',
          isRequired: true,
          scaleMin: 1,
          scaleMax: 5
        },
        {
          id: 'q2',
          text: 'Overall rating of the instructor.',
          type: QUESTION_TYPES.NUMERIC_RATING,
          category: 'Overall',
          isRequired: true,
          scaleMin: 1,
          scaleMax: 5
        },
        {
          id: 'q3',
          text: 'Constructive suggestions for improvement.',
          type: QUESTION_TYPES.LONG_TEXT,
          category: 'Qualitative',
          isRequired: false
        }
      ],
      createdBy: admin.user._id
    });

    // Create Campaign
    const now = new Date();
    campaign = await FeedbackCampaign.create({
      title: 'Spring 2026 Feedback',
      form: form._id,
      formVersion: 1,
      startDate: new Date(now.getTime() - 24 * 3600 * 1000),
      deadline: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      status: 'published',
      anonymity: {
        mode: 'anonymous',
        minResponsesForReport: 3
      },
      createdBy: admin.user._id
    });

    // Assign student as eligible recipient
    await CampaignRecipient.create({
      campaign: campaign._id,
      student: studentUser._id,
      status: 'invited',
      reminderCount: 0
    });
  });

  it('should allow student to save and resume a draft', async () => {
    const draftAnswers = [
      { questionId: 'q1', answer: { ratingValue: 4 } }
    ];

    // Save draft
    const saveRes = await request(app)
      .post(`/api/v1/submissions/campaigns/${campaign._id}/draft`)
      .set(authHeader(studentToken))
      .send({ answers: draftAnswers });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.success).toBe(true);

    // Resume form
    const formRes = await request(app)
      .get(`/api/v1/submissions/campaigns/${campaign._id}/form`)
      .set(authHeader(studentToken));

    expect(formRes.status).toBe(200);
    expect(formRes.body.data.savedDraft.length).toBe(1);
    expect(formRes.body.data.savedDraft[0].questionId).toBe('q1');
  });

  it('should successfully submit anonymous feedback and decouple student identity', async () => {
    const answersPayload = {
      answers: [
        { questionId: 'q1', ratingValue: 5 },
        { questionId: 'q2', ratingValue: 4 },
        { questionId: 'q3', textValue: 'Exceptional lecture delivery on memory management.' }
      ]
    };

    const res = await request(app)
      .post(`/api/v1/submissions/campaigns/${campaign._id}/submit`)
      .set(authHeader(studentToken))
      .send(answersPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.receiptCode).toBeDefined();

    // Verify CampaignRecipient status transitioned to 'submitted'
    const recipient = await CampaignRecipient.findOne({ campaign: campaign._id, student: studentUser._id });
    expect(recipient.status).toBe('submitted');
    expect(recipient.submittedAt).toBeDefined();

    // STRICT TECHNICAL ANONYMITY VERIFICATION:
    // In FeedbackSubmission, the student field MUST BE NULL!
    const submission = await FeedbackSubmission.findOne({ campaign: campaign._id });
    expect(submission).toBeDefined();
    expect(submission.student).toBeNull();
    expect(submission.anonymityMode).toBe('anonymous');
    expect(submission.answers.length).toBe(3);
  });

  it('should strictly prevent duplicate submissions from the same student', async () => {
    const answersPayload = {
      answers: [
        { questionId: 'q1', ratingValue: 5 },
        { questionId: 'q2', ratingValue: 5 }
      ]
    };

    // First submission: Success
    const firstRes = await request(app)
      .post(`/api/v1/submissions/campaigns/${campaign._id}/submit`)
      .set(authHeader(studentToken))
      .send(answersPayload);
    expect(firstRes.status).toBe(201);

    // Second submission attempt: Must be rejected with 409 Conflict
    const secondRes = await request(app)
      .post(`/api/v1/submissions/campaigns/${campaign._id}/submit`)
      .set(authHeader(studentToken))
      .send(answersPayload);

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.errorCode).toBe('CONFLICT');

    // Only 1 submission record should exist in the database
    const count = await FeedbackSubmission.countDocuments({ campaign: campaign._id });
    expect(count).toBe(1);
  });

  it('should reject feedback submission from an ineligible student', async () => {
    const stranger = await createTestUser({ role: ROLES.STUDENT, email: 'stranger@uni.edu' });

    const res = await request(app)
      .post(`/api/v1/submissions/campaigns/${campaign._id}/submit`)
      .set(authHeader(stranger.token))
      .send({
        answers: [{ questionId: 'q1', ratingValue: 4 }]
      });

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('should reject late submission when campaign deadline has passed', async () => {
    // Expire campaign
    campaign.deadline = new Date(Date.now() - 1000);
    await campaign.save();

    const res = await request(app)
      .post(`/api/v1/submissions/campaigns/${campaign._id}/submit`)
      .set(authHeader(studentToken))
      .send({
        answers: [{ questionId: 'q1', ratingValue: 5 }]
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('deadline');
  });
});
