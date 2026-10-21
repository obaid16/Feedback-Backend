import {
  getCampaignReminderStatus,
  reconcilePendingReminders
} from '../services/queue/scheduler.js';
import { executeSendReminder, executeSendInvitation } from '../services/queue/worker.js';
import { CampaignRecipient } from '../models/CampaignRecipient.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/errors.js';

export async function getReminderOverview(req, res, next) {
  try {
    const status = await getCampaignReminderStatus(req.params.campaignId);
    return sendSuccess(res, status, 'Campaign reminder delivery metrics');
  } catch (err) {
    next(err);
  }
}

export async function triggerReconciliation(req, res, next) {
  try {
    const result = await reconcilePendingReminders();
    return sendSuccess(res, result, 'Manual reminder reconciliation triggered');
  } catch (err) {
    next(err);
  }
}

export async function retryRecipientReminder(req, res, next) {
  try {
    const recipient = await CampaignRecipient.findById(req.params.recipientId);
    if (!recipient) throw new NotFoundError('Recipient not found');

    let result;
    if (recipient.status === 'eligible') {
      result = await executeSendInvitation(recipient._id);
    } else {
      const nextReminder = Math.min((recipient.reminderCount || 0) + 1, 2);
      result = await executeSendReminder(recipient._id, nextReminder);
    }

    return sendSuccess(res, result, 'Recipient reminder retried');
  } catch (err) {
    next(err);
  }
}
