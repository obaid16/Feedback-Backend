import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { Department } from '../src/models/Department.js';
import { FacultyProfile } from '../src/models/FacultyProfile.js';
import { FeedbackForm } from '../src/models/FeedbackForm.js';
import { FeedbackCampaign } from '../src/models/FeedbackCampaign.js';
import { ROLES } from '../src/constants/roles.js';
import { createTestUser, authHeader } from './testHelpers.js';

describe('Analytics Endpoints', () => {
  let adminToken, studentToken, dept, faculty, campaign;

  beforeEach(async () => {
    const admin = await createTestUser({ role: ROLES.ADMIN });
    adminToken = admin.token;

    const student = await createTestUser({ role: ROLES.STUDENT });
    studentToken = student.token;

    dept = await Department.create({ name: 'Robotics Engineering', code: 'ROBO' });
    faculty = await FacultyProfile.create({
      displayName: 'Dr. Nikola Tesla',
      email: 'tesla@robo.edu',
      employeeId: 'EMP-TESLA-1',
      department: dept._id
    });

    const form = await FeedbackForm.create({
      title: 'Robotics 101 Form',
      status: 'published',
      questions: [{ id: 'q1', text: 'Course clarity', type: 'numeric_rating' }],
      createdBy: admin.user._id
    });

    campaign = await FeedbackCampaign.create({
      title: 'Robotics 101 Evaluation',
      form: form._id,
      formVersion: 1,
      targetDepartment: dept._id,
      targetFaculty: faculty._id,
      startDate: new Date(),
      deadline: new Date(Date.now() + 86400000),
      status: 'published',
      createdBy: admin.user._id
    });
  });

  it('should return admin overview metrics for authorized administrators', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics).toBeDefined();
    expect(res.body.data.metrics.totalStudents).toBeGreaterThanOrEqual(1);
    expect(res.body.data.metrics.totalFaculty).toBeGreaterThanOrEqual(1);
    expect(res.body.data.metrics.totalDepartments).toBeGreaterThanOrEqual(1);
  });

  it('should forbid students from accessing administrative analytics', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set(authHeader(studentToken));

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('ROLE_FORBIDDEN');
  });

  it('should return campaign completion breakdown and question aggregates', async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/campaigns/${campaign._id}`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.completion).toBeDefined();
    expect(res.body.data.questionAggregates).toBeDefined();
  });

  it('should return department response rate summary', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/departments')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.departments)).toBe(true);
    const roboDept = res.body.data.departments.find(d => d.code === 'ROBO');
    expect(roboDept).toBeDefined();
  });
});
