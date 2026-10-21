import mongoose from 'mongoose';
import { ALL_RECIPIENT_STATUSES, RECIPIENT_STATUS } from '../constants/campaignStatus.js';

const emailHistorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['invitation', 'reminder_1', 'reminder_2', 'escalation', 'confirmation'],
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    messageId: {
      type: String
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'failed', 'bounced'],
      default: 'sent'
    },
    errorMessage: {
      type: String
    }
  },
  { _id: false }
);

const draftAnswerSchema = new mongoose.Schema(
  {
    questionId: String,
    answer: mongoose.Schema.Types.Mixed
  },
  { _id: false }
);

const campaignRecipientSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedbackCampaign',
      required: true,
      index: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ALL_RECIPIENT_STATUSES,
      default: RECIPIENT_STATUS.ELIGIBLE,
      index: true
    },
    invitationSentAt: {
      type: Date
    },
    lastReminderSentAt: {
      type: Date
    },
    reminderCount: {
      type: Number,
      default: 0
    },
    nextScheduledReminderAt: {
      type: Date,
      index: true
    },
    escalatedToAdminAt: {
      type: Date
    },
    emailHistory: [emailHistorySchema],
    submittedAt: {
      type: Date
    },
    // Optional draft answers for students to resume partially filled forms before submission
    savedDraft: {
      answers: [draftAnswerSchema],
      lastSavedAt: Date
    }
  },
  {
    timestamps: true
  }
);

// One recipient record per student per campaign
campaignRecipientSchema.index({ campaign: 1, student: 1 }, { unique: true });
campaignRecipientSchema.index({ campaign: 1, status: 1 });
campaignRecipientSchema.index({ status: 1, nextScheduledReminderAt: 1 });

export const CampaignRecipient = mongoose.model('CampaignRecipient', campaignRecipientSchema);
