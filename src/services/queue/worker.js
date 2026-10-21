import { Worker } from 'bullmq';
import { CampaignRecipient } from '../../models/CampaignRecipient.js';
import { FeedbackCampaign } from '../../models/FeedbackCampaign.js';
import { User } from '../../models/User.js';
import { RECIPIENT_STATUS, CAMPAIGN_STATUS } from '../../constants/campaignStatus.js';
import { ROLES } from '../../constants/roles.js';
import {
  sendCampaignInvitation,
  sendCampaignReminder,
  sendAdminEscalation
} from '../email/email.service.js';
import { createNotification } from '../notification.service.js';
import { scheduleCampaignJob, getRedisClient } from './queue.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

/**
 * Step 1: Send invitation to eligible student
 */
export async function executeSendInvitation(recipientId) {
  const recipient = await CampaignRecipient.findById(recipientId)
    .populate('student', 'name email status')
    .populate({
      path: 'campaign',
      populate: [
        { path: 'targetCourse', select: 'name code' },
        { path: 'targetFaculty', select: 'displayName' }
      ]
    });

  if (!recipient || !recipient.student || !recipient.campaign) {
    logger.warn({ recipientId }, 'Recipient or campaign not found for invitation');
    return { status: 'skipped', reason: 'not_found' };
  }

  // Suppression check: Do not send if already submitted or campaign is not active/published
  if (recipient.status === RECIPIENT_STATUS.SUBMITTED) {
    logger.info({ recipientId }, 'Suppressed invitation: Student has already submitted');
    return { status: 'suppressed', reason: 'already_submitted' };
  }

  const campaign = recipient.campaign;
  if (campaign.status === CAMPAIGN_STATUS.CLOSED || campaign.status === CAMPAIGN_STATUS.ARCHIVED) {
    logger.info({ recipientId }, 'Suppressed invitation: Campaign is closed or archived');
    return { status: 'suppressed', reason: 'campaign_closed' };
  }

  const formUrl = `${env.FRONTEND_URL}/feedback/${campaign._id}`;
  const emailRes = await sendCampaignInvitation({
    studentEmail: recipient.student.email,
    studentName: recipient.student.name,
    campaignTitle: campaign.title,
    courseName: campaign.targetCourse?.name,
    facultyName: campaign.targetFaculty?.displayName,
    deadline: campaign.deadline,
    formUrl
  });

  const firstReminderHours = campaign.reminders?.firstReminderHours || env.REMINDER_SCHEDULE_HOURS_1;
  const nextReminderDate = new Date(Date.now() + firstReminderHours * 3600 * 1000);

  recipient.status = RECIPIENT_STATUS.INVITED;
  recipient.invitationSentAt = new Date();
  recipient.nextScheduledReminderAt = nextReminderDate;
  recipient.emailHistory.push({
    type: 'invitation',
    sentAt: new Date(),
    messageId: emailRes.messageId,
    status: emailRes.success ? 'sent' : 'failed',
    errorMessage: emailRes.errorMessage
  });

  await recipient.save();

  // Create in-app notification
  await createNotification({
    recipient: recipient.student._id,
    title: `Feedback Form: ${campaign.title}`,
    message: `You have been requested to submit feedback for ${campaign.title}. Deadline: ${new Date(campaign.deadline).toLocaleDateString()}`,
    type: 'campaign_invitation',
    relatedCampaign: campaign._id
  });

  // Schedule Reminder 1
  if (campaign.reminders?.enabled) {
    const delayMs = firstReminderHours * 3600 * 1000;
    await scheduleCampaignJob('send_reminder', {
      recipientId: recipient._id.toString(),
      campaignId: campaign._id.toString(),
      reminderNumber: 1
    }, { delay: delayMs });
  }

  return { status: 'sent', recipientId: recipient._id };
}

/**
 * Step 2 & 3: Send Reminder 1 or Reminder 2 to student
 */
export async function executeSendReminder(recipientId, reminderNumber = 1) {
  const recipient = await CampaignRecipient.findById(recipientId)
    .populate('student', 'name email status')
    .populate('campaign');

  if (!recipient || !recipient.student || !recipient.campaign) {
    return { status: 'skipped', reason: 'not_found' };
  }

  // SUPPRESSION CHECK: If student has submitted, suppress immediately!
  if (recipient.status === RECIPIENT_STATUS.SUBMITTED) {
    logger.info({ recipientId, reminderNumber }, 'Suppressed reminder: Student already submitted feedback');
    return { status: 'suppressed', reason: 'already_submitted' };
  }

  const campaign = recipient.campaign;
  // Check campaign status and deadline
  if (campaign.status === CAMPAIGN_STATUS.CLOSED || campaign.status === CAMPAIGN_STATUS.ARCHIVED || new Date() > new Date(campaign.deadline)) {
    logger.info({ recipientId, reminderNumber }, 'Suppressed reminder: Campaign closed or deadline passed');
    return { status: 'suppressed', reason: 'campaign_closed_or_expired' };
  }

  const formUrl = `${env.FRONTEND_URL}/feedback/${campaign._id}`;
  const emailRes = await sendCampaignReminder({
    studentEmail: recipient.student.email,
    studentName: recipient.student.name,
    campaignTitle: campaign.title,
    deadline: campaign.deadline,
    formUrl,
    reminderNumber
  });

  recipient.reminderCount = reminderNumber;
  recipient.lastReminderSentAt = new Date();
  recipient.emailHistory.push({
    type: reminderNumber === 1 ? 'reminder_1' : 'reminder_2',
    sentAt: new Date(),
    messageId: emailRes.messageId,
    status: emailRes.success ? 'sent' : 'failed',
    errorMessage: emailRes.errorMessage
  });

  // In-app notification
  await createNotification({
    recipient: recipient.student._id,
    title: `Pending Feedback (${reminderNumber}/2): ${campaign.title}`,
    message: `Reminder: Your feedback for ${campaign.title} is still pending. Deadline is approaching.`,
    type: 'campaign_reminder',
    relatedCampaign: campaign._id
  });

  if (reminderNumber === 1) {
    recipient.status = RECIPIENT_STATUS.REMINDER_1_SENT;
    const secondReminderHours = campaign.reminders?.secondReminderHours || env.REMINDER_SCHEDULE_HOURS_2;
    const nextReminderDate = new Date(Date.now() + (secondReminderHours - (campaign.reminders?.firstReminderHours || 0)) * 3600 * 1000);
    recipient.nextScheduledReminderAt = nextReminderDate;

    await recipient.save();

    // Schedule Reminder 2
    const delayMs = (secondReminderHours - (campaign.reminders?.firstReminderHours || 0)) * 3600 * 1000;
    await scheduleCampaignJob('send_reminder', {
      recipientId: recipient._id.toString(),
      campaignId: campaign._id.toString(),
      reminderNumber: 2
    }, { delay: Math.max(delayMs, 1000) });
  } else {
    // Reminder 2 sent. Next step is escalation to admin if still incomplete.
    recipient.status = RECIPIENT_STATUS.REMINDER_2_SENT;
    const escalationHours = campaign.reminders?.adminEscalationHours || env.ESCALATION_SCHEDULE_HOURS;
    const escalationDate = new Date(Date.now() + (escalationHours - (campaign.reminders?.secondReminderHours || 0)) * 3600 * 1000);
    recipient.nextScheduledReminderAt = escalationDate;

    await recipient.save();

    // Schedule escalation check
    const delayMs = (escalationHours - (campaign.reminders?.secondReminderHours || 0)) * 3600 * 1000;
    await scheduleCampaignJob('escalate_admin', {
      campaignId: campaign._id.toString()
    }, { delay: Math.max(delayMs, 1000) });
  }

  return { status: 'sent', reminderNumber, recipientId };
}

/**
 * Step 4: Final Overdue Notification to Administrators
 */
export async function executeAdminEscalation(campaignId) {
  const campaign = await FeedbackCampaign.findById(campaignId).populate('createdBy', 'name email');
  if (!campaign) {
    return { status: 'skipped', reason: 'campaign_not_found' };
  }

  // Count pending students for this campaign
  const pendingCount = await CampaignRecipient.countDocuments({
    campaign: campaignId,
    status: { $in: [RECIPIENT_STATUS.INVITED, RECIPIENT_STATUS.REMINDER_1_SENT, RECIPIENT_STATUS.REMINDER_2_SENT] }
  });

  const totalEligible = await CampaignRecipient.countDocuments({ campaign: campaignId });

  if (pendingCount === 0) {
    logger.info({ campaignId }, 'All recipients completed. Escalation suppressed.');
    return { status: 'suppressed', reason: 'all_completed' };
  }

  // Mark pending recipients as escalated_admin
  await CampaignRecipient.updateMany(
    {
      campaign: campaignId,
      status: { $in: [RECIPIENT_STATUS.REMINDER_2_SENT, RECIPIENT_STATUS.INVITED, RECIPIENT_STATUS.REMINDER_1_SENT] }
    },
    {
      $set: {
        status: RECIPIENT_STATUS.ESCALATED_ADMIN,
        escalatedToAdminAt: new Date()
      }
    }
  );

  // Find all administrators to notify
  const admins = await User.find({
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
    status: 'active'
  }).select('name email');

  const dashboardUrl = `${env.FRONTEND_URL}/admin/campaigns/${campaign._id}`;

  for (const admin of admins) {
    // Send email to admin
    await sendAdminEscalation({
      adminEmail: admin.email,
      adminName: admin.name,
      campaignTitle: campaign.title,
      campaignId: campaign._id.toString(),
      pendingCount,
      totalEligible,
      dashboardUrl
    });

    // In-app notification
    await createNotification({
      recipient: admin._id,
      title: `Overdue Escalation: ${campaign.title}`,
      message: `Campaign "${campaign.title}" has ${pendingCount} of ${totalEligible} submissions pending after automated reminders.`,
      type: 'admin_overdue_escalation',
      relatedCampaign: campaign._id,
      metadata: { pendingCount, totalEligible }
    });
  }

  logger.info({ campaignId, pendingCount, totalEligible }, 'Admin escalation dispatched successfully');
  return { status: 'escalated', pendingCount, totalEligible };
}

/**
 * Initialize BullMQ Worker process if Redis is active
 */
export function startWorker() {
  const redis = getRedisClient();
  if (!redis) {
    logger.info('BullMQ worker disabled (running with DB scheduler)');
    return null;
  }

  try {
    const worker = new Worker(
      'campaign-jobs',
      async (job) => {
        logger.info({ jobName: job.name, id: job.id }, 'Processing queue job');
        switch (job.name) {
          case 'send_invitation':
            return executeSendInvitation(job.data.recipientId);
          case 'send_reminder':
            return executeSendReminder(job.data.recipientId, job.data.reminderNumber);
          case 'escalate_admin':
            return executeAdminEscalation(job.data.campaignId);
          default:
            logger.warn({ jobName: job.name }, 'Unknown job name');
        }
      },
      {
        connection: redis,
        concurrency: env.QUEUE_CONCURRENCY
      }
    );

    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, jobName: job?.name, err: err.message }, 'Job execution failed');
    });

    logger.info('BullMQ Worker started successfully');
    return worker;
  } catch (err) {
    logger.warn({ err }, 'Could not start BullMQ worker');
    return null;
  }
}
