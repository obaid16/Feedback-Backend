import { describe, it, expect } from 'vitest';
import { CampaignRecipient } from '../src/models/CampaignRecipient.js';
import { FeedbackCampaign } from '../src/models/FeedbackCampaign.js';
import { FeedbackForm } from '../src/models/FeedbackForm.js';
import { User } from '../src/models/User.js';
import { ROLES } from '../src/constants/roles.js';
import { RECIPIENT_STATUS } from '../src/constants/campaignStatus.js';
import {
  executeSendInvitation,
  executeSendReminder,
  executeAdminEscalation
} from '../src/services/queue/worker.js';
import { reconcilePendingReminders } from '../src/services/queue/scheduler.js';
import { createTestUser } from './testHelpers.js';

describe('Email Delivery, Reminders, and Overdue Escalation', () => {
  let adminUser, studentUser, campaign;

  beforeEach(async () => {
    const admin = await createTestUser({ role: ROLES.ADMIN, email: 'dean@uni.edu' });
    adminUser = admin.user;

    const student = await createTestUser({ role: ROLES.STUDENT, email: 'remind_student@uni.edu' });
    studentUser = student.user;

    const form = await FeedbackForm.create({
      title: 'Chemistry Evaluation',
      version: 1,
      status: 'published',
      questions: [{ id: 'q1', text: 'Clarity of lectures', type: 'likert_scale' }],
      createdBy: adminUser._id
    });

    const now = new Date();
    campaign = await FeedbackCampaign.create({
      title: 'Chemistry 101 Midterm',
      form: form._id,
      formVersion: 1,
      startDate: new Date(now.getTime() - 24 * 3600 * 1000),
      deadline: new Date(now.getTime() + 10 * 24 * 3600 * 1000),
      status: 'published',
      reminders: {
        enabled: true,
        firstReminderHours: 48,
        secondReminderHours: 96,
        adminEscalationHours: 120
      },
      createdBy: adminUser._id
    });
  });

  it('should send initial invitation and schedule Reminder 1', async () => {
    const recipient = await CampaignRecipient.create({
      campaign: campaign._id,
      student: studentUser._id,
      status: RECIPIENT_STATUS.ELIGIBLE
    });

    const result = await executeSendInvitation(recipient._id);
    expect(result.status).toBe('sent');

    const updated = await CampaignRecipient.findById(recipient._id);
    expect(updated.status).toBe(RECIPIENT_STATUS.INVITED);
    expect(updated.invitationSentAt).toBeDefined();
    expect(updated.nextScheduledReminderAt).toBeDefined();
    expect(updated.emailHistory.length).toBe(1);
    expect(updated.emailHistory[0].type).toBe('invitation');
  });

  it('should send Reminder 1 and transition to reminder_1_sent', async () => {
    const recipient = await CampaignRecipient.create({
      campaign: campaign._id,
      student: studentUser._id,
      status: RECIPIENT_STATUS.INVITED,
      reminderCount: 0
    });

    const result = await executeSendReminder(recipient._id, 1);
    expect(result.status).toBe('sent');

    const updated = await CampaignRecipient.findById(recipient._id);
    expect(updated.status).toBe(RECIPIENT_STATUS.REMINDER_1_SENT);
    expect(updated.reminderCount).toBe(1);
    expect(updated.lastReminderSentAt).toBeDefined();
  });

  it('should send Reminder 2 and schedule escalation', async () => {
    const recipient = await CampaignRecipient.create({
      campaign: campaign._id,
      student: studentUser._id,
      status: RECIPIENT_STATUS.REMINDER_1_SENT,
      reminderCount: 1
    });

    const result = await executeSendReminder(recipient._id, 2);
    expect(result.status).toBe('sent');

    const updated = await CampaignRecipient.findById(recipient._id);
    expect(updated.status).toBe(RECIPIENT_STATUS.REMINDER_2_SENT);
    expect(updated.reminderCount).toBe(2);
  });

  it('SUPPRESSION: should suppress reminder immediately if student has already submitted', async () => {
    const recipient = await CampaignRecipient.create({
      campaign: campaign._id,
      student: studentUser._id,
      status: RECIPIENT_STATUS.SUBMITTED, // Already submitted
      submittedAt: new Date()
    });

    const result = await executeSendReminder(recipient._id, 1);
    expect(result.status).toBe('suppressed');
    expect(result.reason).toBe('already_submitted');

    // Recipient status must remain unchanged
    const updated = await CampaignRecipient.findById(recipient._id);
    expect(updated.status).toBe(RECIPIENT_STATUS.SUBMITTED);
  });

  it('should escalate overdue pending campaign to administrators', async () => {
    await CampaignRecipient.create({
      campaign: campaign._id,
      student: studentUser._id,
      status: RECIPIENT_STATUS.REMINDER_2_SENT,
      reminderCount: 2
    });

    const result = await executeAdminEscalation(campaign._id);
    expect(result.status).toBe('escalated');
    expect(result.pendingCount).toBe(1);

    const updated = await CampaignRecipient.findOne({ campaign: campaign._id });
    expect(updated.status).toBe(RECIPIENT_STATUS.ESCALATED_ADMIN);
    expect(updated.escalatedToAdminAt).toBeDefined();
  });

  it('scheduler reconciliation should recover and process due reminders', async () => {
    // Recipient whose scheduled reminder time passed 1 hour ago
    await CampaignRecipient.create({
      campaign: campaign._id,
      student: studentUser._id,
      status: RECIPIENT_STATUS.INVITED,
      reminderCount: 0,
      nextScheduledReminderAt: new Date(Date.now() - 3600 * 1000)
    });

    const reconResult = await reconcilePendingReminders();
    expect(reconResult.processed).toBeGreaterThanOrEqual(1);

    const updated = await CampaignRecipient.findOne({ campaign: campaign._id, student: studentUser._id });
    expect(updated.status).toBe(RECIPIENT_STATUS.REMINDER_1_SENT);
  });
});
