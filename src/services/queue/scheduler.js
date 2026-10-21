import { CampaignRecipient } from '../../models/CampaignRecipient.js';
import { FeedbackCampaign } from '../../models/FeedbackCampaign.js';
import { RECIPIENT_STATUS, CAMPAIGN_STATUS } from '../../constants/campaignStatus.js';
import {
  executeSendInvitation,
  executeSendReminder,
  executeAdminEscalation
} from './worker.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

let schedulerInterval = null;

/**
 * Reconcile pending reminders and recover missed jobs
 */
export async function reconcilePendingReminders() {
  try {
    const now = new Date();

    // Find all active campaigns
    const activeCampaigns = await FeedbackCampaign.find({
      status: { $in: [CAMPAIGN_STATUS.PUBLISHED, CAMPAIGN_STATUS.ACTIVE] },
      deadline: { $gt: now },
      'reminders.enabled': true
    }).select('_id reminders');

    if (!activeCampaigns.length) {
      return { processed: 0 };
    }

    const campaignIds = activeCampaigns.map(c => c._id);

    // Find pending recipients whose scheduled reminder time has arrived or passed
    const pendingRecipients = await CampaignRecipient.find({
      campaign: { $in: campaignIds },
      status: {
        $in: [
          RECIPIENT_STATUS.ELIGIBLE,
          RECIPIENT_STATUS.INVITED,
          RECIPIENT_STATUS.REMINDER_1_SENT,
          RECIPIENT_STATUS.REMINDER_2_SENT
        ]
      },
      nextScheduledReminderAt: { $lte: now }
    }).limit(100);

    let processedCount = 0;

    for (const recipient of pendingRecipients) {
      // Double check suppression: if student submitted, skip immediately
      if (recipient.status === RECIPIENT_STATUS.SUBMITTED) {
        continue;
      }

      if (recipient.status === RECIPIENT_STATUS.ELIGIBLE) {
        await executeSendInvitation(recipient._id);
        processedCount++;
      } else if (recipient.status === RECIPIENT_STATUS.INVITED && recipient.reminderCount === 0) {
        await executeSendReminder(recipient._id, 1);
        processedCount++;
      } else if (recipient.status === RECIPIENT_STATUS.REMINDER_1_SENT && recipient.reminderCount === 1) {
        await executeSendReminder(recipient._id, 2);
        processedCount++;
      } else if (recipient.status === RECIPIENT_STATUS.REMINDER_2_SENT && recipient.reminderCount === 2) {
        await executeAdminEscalation(recipient.campaign);
        processedCount++;
      }
    }

    if (processedCount > 0) {
      logger.info({ processedCount }, 'Reconciliation cycle processed scheduled campaign actions');
    }

    return { processed: processedCount };
  } catch (err) {
    logger.error({ err: err.message }, 'Error during reminder reconciliation cycle');
    return { error: err.message };
  }
}

/**
 * Start the recurring scheduler loop
 */
export function startScheduler() {
  if (schedulerInterval) return;

  const intervalMs = env.SCHEDULER_RECONCILIATION_INTERVAL_MS || 300000;
  logger.info({ intervalMs }, 'Starting persistent campaign reminder reconciliation scheduler');

  // Run immediate first check
  reconcilePendingReminders().catch(() => {});

  schedulerInterval = setInterval(() => {
    reconcilePendingReminders().catch(() => {});
  }, intervalMs);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Campaign scheduler stopped');
  }
}

/**
 * Retrieve granular reminder status for an administrative campaign overview
 */
export async function getCampaignReminderStatus(campaignId) {
  const [totalEligible, invited, reminder1Sent, reminder2Sent, submitted, escalated] = await Promise.all([
    CampaignRecipient.countDocuments({ campaign: campaignId }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.INVITED }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.REMINDER_1_SENT }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.REMINDER_2_SENT }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.SUBMITTED }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.ESCALATED_ADMIN })
  ]);

  return {
    totalEligible,
    invited,
    reminder1Sent,
    reminder2Sent,
    submitted,
    escalated,
    completionPercentage: totalEligible > 0 ? Math.round((submitted / totalEligible) * 100) : 0,
    pendingTotal: totalEligible - submitted
  };
}
