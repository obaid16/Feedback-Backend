import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Course } from '../models/Course.js';
import { FacultyProfile } from '../models/FacultyProfile.js';
import { FeedbackForm } from '../models/FeedbackForm.js';
import { FeedbackCampaign } from '../models/FeedbackCampaign.js';
import { CampaignRecipient } from '../models/CampaignRecipient.js';
import { ROLES } from '../constants/roles.js';
import { QUESTION_TYPES } from '../constants/questionTypes.js';
import { CAMPAIGN_STATUS, RECIPIENT_STATUS } from '../constants/campaignStatus.js';
import { hashPassword } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

export async function seedDatabase(shouldDisconnect = false) {
  try {
    logger.info('Connecting to database for institutional seeding...');
    await connectDatabase();

    // Clear existing data in dev
    logger.info('Clearing previous test/seed records...');
    await Promise.all([
      User.deleteMany({}),
      Department.deleteMany({}),
      Course.deleteMany({}),
      FacultyProfile.deleteMany({}),
      FeedbackForm.deleteMany({}),
      FeedbackCampaign.deleteMany({}),
      CampaignRecipient.deleteMany({})
    ]);

    const adminPasswordHash = await hashPassword('AdminPass123!');
    const studentPasswordHash = await hashPassword('StudentPass123!');

    // 1. Departments
    const csDept = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
      description: 'Department of Computer Science and Engineering',
      isActive: true
    });

    const eceDept = await Department.create({
      name: 'Electrical & Computer Engineering',
      code: 'ECE',
      description: 'Department of Electrical and Computer Engineering',
      isActive: true
    });

    // 2. Users
    const superAdmin = await User.create({
      name: 'Chief Academic Officer',
      email: 'superadmin@institution.edu',
      passwordHash: adminPasswordHash,
      role: ROLES.SUPER_ADMIN,
      authProvider: 'local',
      status: 'active'
    });

    const admin = await User.create({
      name: 'Academic Affairs Admin',
      email: 'admin@institution.edu',
      passwordHash: adminPasswordHash,
      role: ROLES.ADMIN,
      department: csDept._id,
      authProvider: 'local',
      status: 'active'
    });

    const student1 = await User.create({
      name: 'Alice Johnson',
      email: 'alice@institution.edu',
      passwordHash: studentPasswordHash,
      role: ROLES.STUDENT,
      studentId: 'STU-2024-001',
      department: csDept._id,
      cohort: '2024-2028',
      authProvider: 'local',
      status: 'active'
    });

    const student2 = await User.create({
      name: 'Bob Smith',
      email: 'bob@institution.edu',
      passwordHash: studentPasswordHash,
      role: ROLES.STUDENT,
      studentId: 'STU-2024-002',
      department: csDept._id,
      cohort: '2024-2028',
      authProvider: 'local',
      status: 'active'
    });

    const student3 = await User.create({
      name: 'Charlie Brown',
      email: 'charlie@institution.edu',
      passwordHash: studentPasswordHash,
      role: ROLES.STUDENT,
      studentId: 'STU-2024-003',
      department: csDept._id,
      cohort: '2024-2028',
      authProvider: 'local',
      status: 'active'
    });

    // 3. Faculty Profiles
    const faculty1 = await FacultyProfile.create({
      displayName: 'Dr. Alan Turing',
      email: 'turing@institution.edu',
      employeeId: 'FAC-CSE-001',
      department: csDept._id,
      designation: 'Professor & Chair'
    });

    const faculty2 = await FacultyProfile.create({
      displayName: 'Dr. Ada Lovelace',
      email: 'lovelace@institution.edu',
      employeeId: 'FAC-CSE-002',
      department: csDept._id,
      designation: 'Associate Professor'
    });

    // 4. Courses
    const course1 = await Course.create({
      name: 'Operating Systems & Concurrency',
      code: 'CS301',
      department: csDept._id,
      cohort: '2024-2028',
      assignedFaculty: [faculty1._id]
    });

    const course2 = await Course.create({
      name: 'Data Structures & Algorithms',
      code: 'CS201',
      department: csDept._id,
      cohort: '2024-2028',
      assignedFaculty: [faculty2._id]
    });

    faculty1.courses = [course1._id];
    await faculty1.save();
    faculty2.courses = [course2._id];
    await faculty2.save();

    // 5. Standard Institutional Feedback Form
    const form = await FeedbackForm.create({
      title: 'Standard Institutional Teaching Evaluation',
      description: 'University-wide faculty and instructional efficacy feedback form.',
      version: 1,
      status: 'published',
      sections: [
        { id: 's1', title: 'Instruction Delivery', description: 'Clarity and pedagogical effectiveness', order: 1 },
        { id: 's2', title: 'Assessment & Feedback', description: 'Grading fairness and timeliness', order: 2 },
        { id: 's3', title: 'Qualitative Reflections', description: 'Open-ended feedback', order: 3 }
      ],
      questions: [
        {
          id: 'q1',
          text: 'The instructor explains difficult concepts clearly and thoroughly.',
          type: QUESTION_TYPES.LIKERT_SCALE,
          category: 'Teaching Clarity',
          isRequired: true,
          order: 1,
          scaleMin: 1,
          scaleMax: 5,
          scaleLabels: { min: 'Strongly Disagree', max: 'Strongly Agree' }
        },
        {
          id: 'q2',
          text: 'The instructor encourages questions and maintains an engaging classroom dynamic.',
          type: QUESTION_TYPES.LIKERT_SCALE,
          category: 'Engagement',
          isRequired: true,
          order: 2,
          scaleMin: 1,
          scaleMax: 5,
          scaleLabels: { min: 'Strongly Disagree', max: 'Strongly Agree' }
        },
        {
          id: 'q3',
          text: 'The instructor is accessible during designated office hours and responsive to emails.',
          type: QUESTION_TYPES.LIKERT_SCALE,
          category: 'Availability',
          isRequired: true,
          order: 3,
          scaleMin: 1,
          scaleMax: 5,
          scaleLabels: { min: 'Strongly Disagree', max: 'Strongly Agree' }
        },
        {
          id: 'q4',
          text: 'Grading criteria and feedback on assignments were transparent and constructive.',
          type: QUESTION_TYPES.LIKERT_SCALE,
          category: 'Assessment Fairness',
          isRequired: true,
          order: 4,
          scaleMin: 1,
          scaleMax: 5,
          scaleLabels: { min: 'Strongly Disagree', max: 'Strongly Agree' }
        },
        {
          id: 'q5',
          text: 'Rate your overall satisfaction with this instructor on a scale of 1 to 5.',
          type: QUESTION_TYPES.NUMERIC_RATING,
          category: 'Overall Rating',
          isRequired: true,
          order: 5,
          scaleMin: 1,
          scaleMax: 5
        },
        {
          id: 'q6',
          text: 'What are the greatest strengths of this instructor, and what constructive suggestions do you have?',
          type: QUESTION_TYPES.LONG_TEXT,
          category: 'Qualitative',
          isRequired: false,
          order: 6
        }
      ],
      createdBy: admin._id
    });

    // 6. Active Feedback Campaign
    const now = new Date();
    const campaign = await FeedbackCampaign.create({
      title: 'Spring 2026 End-Term Evaluation: CS301',
      description: 'Official student evaluation for Operating Systems instruction.',
      purpose: 'End-of-Semester Quality Assurance',
      form: form._id,
      formVersion: 1,
      targetDepartment: csDept._id,
      targetCourse: course1._id,
      targetFaculty: faculty1._id,
      audience: {
        departments: [csDept._id],
        courses: [course1._id],
        cohorts: ['2024-2028']
      },
      startDate: new Date(now.getTime() - 24 * 3600 * 1000),
      deadline: new Date(now.getTime() + 14 * 24 * 3600 * 1000), // 14 days ahead
      status: CAMPAIGN_STATUS.PUBLISHED,
      anonymity: {
        mode: 'anonymous',
        disclosedPolicy: 'Feedback is strictly anonymous. Identifiers are physically decoupled from answers.',
        minResponsesForReport: 3
      },
      reminders: {
        enabled: true,
        firstReminderHours: 48,
        secondReminderHours: 96,
        adminEscalationHours: 120
      },
      metrics: {
        totalEligible: 3,
        totalSubmissions: 0,
        responseRate: 0
      },
      createdBy: admin._id,
      publishedAt: new Date()
    });

    // 7. Recipients for the campaign
    await CampaignRecipient.create([
      {
        campaign: campaign._id,
        student: student1._id,
        status: RECIPIENT_STATUS.INVITED,
        invitationSentAt: new Date(),
        reminderCount: 0,
        nextScheduledReminderAt: new Date(Date.now() + 48 * 3600 * 1000)
      },
      {
        campaign: campaign._id,
        student: student2._id,
        status: RECIPIENT_STATUS.INVITED,
        invitationSentAt: new Date(),
        reminderCount: 0,
        nextScheduledReminderAt: new Date(Date.now() + 48 * 3600 * 1000)
      },
      {
        campaign: campaign._id,
        student: student3._id,
        status: RECIPIENT_STATUS.INVITED,
        invitationSentAt: new Date(),
        reminderCount: 0,
        nextScheduledReminderAt: new Date(Date.now() + 48 * 3600 * 1000)
      }
    ]);

    logger.info('========================================================');
    logger.info('✨ Institutional Seeding Completed Successfully! ✨');
    logger.info('Demo Credentials:');
    logger.info('  Super Admin : superadmin@institution.edu | AdminPass123!');
    logger.info('  Admin       : admin@institution.edu      | AdminPass123!');
    logger.info('  Student 1   : alice@institution.edu      | StudentPass123!');
    logger.info('  Student 2   : bob@institution.edu        | StudentPass123!');
    logger.info('  Student 3   : charlie@institution.edu    | StudentPass123!');
    logger.info('Active Campaign:');
    logger.info(`  ID: ${campaign._id} ("${campaign.title}")`);
    logger.info('========================================================');
  } catch (err) {
    logger.error({ err }, 'Error during database seeding');
    throw err;
  } finally {
    if (shouldDisconnect) {
      await disconnectDatabase();
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase(true)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
