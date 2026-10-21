import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { calculateDeterministicStats, generateFacultyReport } from '../src/services/report.service.js';
import { FeedbackCampaign } from '../src/models/FeedbackCampaign.js';
import { FeedbackForm } from '../src/models/FeedbackForm.js';
import { FacultyProfile } from '../src/models/FacultyProfile.js';
import { Department } from '../src/models/Department.js';
import { FeedbackSubmission } from '../src/models/FeedbackSubmission.js';
import { CampaignRecipient } from '../src/models/CampaignRecipient.js';
import { ROLES } from '../src/constants/roles.js';
import { createTestUser, authHeader } from './testHelpers.js';

describe('Faculty Reports, Deterministic Statistics & PDF Exports', () => {
  it('DETERMINISTIC MATH: should accurately compute average ratings, distributions, and percentages without AI hallucination', () => {
    // 3 mock submissions with ratings [5, 4, 3] on q1
    const mockSubmissions = [
      { answers: [{ questionId: 'q1', category: 'Clarity', ratingValue: 5 }] },
      { answers: [{ questionId: 'q1', category: 'Clarity', ratingValue: 4 }] },
      { answers: [{ questionId: 'q1', category: 'Clarity', ratingValue: 3 }] }
    ];

    const stats = calculateDeterministicStats(mockSubmissions, 4);

    expect(stats.totalResponses).toBe(3);
    expect(stats.totalEligibleStudents).toBe(4);
    expect(stats.responseRatePercentage).toBe(75); // 3 / 4 = 75%
    expect(stats.overallAverageRating).toBe(4.0); // (5 + 4 + 3) / 3 = 4.0

    // Check distribution
    const dist5 = stats.ratingDistribution.find(d => d.rating === 5);
    const dist4 = stats.ratingDistribution.find(d => d.rating === 4);
    const dist3 = stats.ratingDistribution.find(d => d.rating === 3);
    expect(dist5.count).toBe(1);
    expect(dist4.count).toBe(1);
    expect(dist3.count).toBe(1);
  });

  it('should generate a completed report and allow authorized administrators to download PDF', async () => {
    const admin = await createTestUser({ role: ROLES.ADMIN });
    const student = await createTestUser({ role: ROLES.STUDENT });

    const dept = await Department.create({ name: 'Data Science', code: 'DS' });
    const faculty = await FacultyProfile.create({
      displayName: 'Dr. Grace Hopper',
      email: 'hopper@ds.edu',
      employeeId: 'EMP-HOPPER-1',
      department: dept._id
    });

    const form = await FeedbackForm.create({
      title: 'Compilers Evaluation',
      status: 'published',
      questions: [{ id: 'q1', text: 'Clarity of lectures', type: 'likert_scale' }],
      createdBy: admin.user._id
    });

    const campaign = await FeedbackCampaign.create({
      title: 'Compilers 301',
      form: form._id,
      formVersion: 1,
      targetFaculty: faculty._id,
      startDate: new Date(),
      deadline: new Date(Date.now() + 86400000),
      status: 'published',
      anonymity: { minResponsesForReport: 3 },
      createdBy: admin.user._id
    });

    // Create 3 submissions to meet the minimum response threshold
    for (const r of [5, 4, 5]) {
      await FeedbackSubmission.create({
        campaign: campaign._id,
        form: form._id,
        formVersion: 1,
        targetFaculty: faculty._id,
        anonymityMode: 'anonymous',
        student: null,
        answers: [{ questionId: 'q1', questionType: 'likert_scale', category: 'Pedagogy', ratingValue: r }],
        status: 'submitted'
      });
    }

    // Generate report
    const report = await generateFacultyReport({
      campaignId: campaign._id,
      facultyId: faculty._id,
      reportingPeriod: 'Semester 1 2026',
      userId: admin.user._id
    });

    expect(report.status).toBe('completed');
    expect(report.pdfFilePath).toBeDefined();

    // Admin downloads PDF
    const pdfRes = await request(app)
      .get(`/api/v1/reports/${report._id}/pdf`)
      .set(authHeader(admin.token));

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toBe('application/pdf');
    expect(pdfRes.headers['content-disposition']).toContain('attachment');

    // Student download attempt must be rejected with 403 Forbidden
    const studentRes = await request(app)
      .get(`/api/v1/reports/${report._id}/pdf`)
      .set(authHeader(student.token));

    expect(studentRes.status).toBe(403);
    expect(studentRes.body.errorCode).toBe('ROLE_FORBIDDEN');
  });
});
