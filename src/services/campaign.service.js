import { FeedbackCampaign } from '../models/FeedbackCampaign.js';
import { FeedbackForm } from '../models/FeedbackForm.js';
import { CampaignRecipient } from '../models/CampaignRecipient.js';
import { User } from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { CAMPAIGN_STATUS, RECIPIENT_STATUS, FORM_STATUS } from '../constants/campaignStatus.js';
import { executeSendInvitation } from './queue/worker.js';
import { logAuditEvent } from './audit.service.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

/**
 * Create a new draft feedback campaign
 */
export async function createFeedbackCampaign({
  title,
  description,
  purpose,
  formId,
  targetDepartment,
  targetCourse,
  targetFaculty,
  audience = {},
  startDate,
  deadline,
  anonymity = {},
  reminders = {},
  userId
}) {
  const form = await FeedbackForm.findById(formId);
  if (!form) throw new NotFoundError('Feedback form not found');

  if (new Date(startDate) >= new Date(deadline)) {
    throw new BadRequestError('Start date must be earlier than the submission deadline.');
  }

  const campaign = await FeedbackCampaign.create({
    title: title.trim(),
    description: description?.trim(),
    purpose: purpose?.trim() || 'Faculty Instructional Evaluation',
    form: form._id,
    formVersion: form.version,
    targetDepartment: targetDepartment || null,
    targetCourse: targetCourse || null,
    targetFaculty: targetFaculty || null,
    audience: {
      cohorts: audience.cohorts || [],
      departments: audience.departments || (targetDepartment ? [targetDepartment] : []),
      courses: audience.courses || (targetCourse ? [targetCourse] : []),
      explicitStudents: audience.explicitStudents || []
    },
    startDate: new Date(startDate),
    deadline: new Date(deadline),
    status: CAMPAIGN_STATUS.DRAFT,
    anonymity: {
      mode: anonymity.mode || 'anonymous',
      disclosedPolicy: anonymity.disclosedPolicy || 'Anonymous technical guarantee.',
      minResponsesForReport: anonymity.minResponsesForReport || 5
    },
    reminders: {
      enabled: reminders.enabled !== false,
      firstReminderHours: reminders.firstReminderHours || 48,
      secondReminderHours: reminders.secondReminderHours || 96,
      adminEscalationHours: reminders.adminEscalationHours || 120
    },
    createdBy: userId
  });

  return campaign;
}

/**
 * Resolve eligible students based on campaign audience criteria
 */
export async function resolveEligibleStudents(campaign) {
  const audience = campaign.audience || {};
  const query = {
    role: ROLES.STUDENT,
    status: 'active'
  };

  const orConditions = [];

  if (Array.isArray(audience.explicitStudents) && audience.explicitStudents.length > 0) {
    orConditions.push({ _id: { $in: audience.explicitStudents } });
  }

  if (Array.isArray(audience.courses) && audience.courses.length > 0) {
    orConditions.push({ course: { $in: audience.courses } });
  }

  if (Array.isArray(audience.departments) && audience.departments.length > 0) {
    orConditions.push({ department: { $in: audience.departments } });
  }

  if (Array.isArray(audience.cohorts) && audience.cohorts.length > 0) {
    orConditions.push({ cohort: { $in: audience.cohorts } });
  }

  // If specific audience filters are specified, use them
  if (orConditions.length > 0) {
    query.$or = orConditions;
  } else if (campaign.targetDepartment) {
    query.department = campaign.targetDepartment;
  }

  return User.find(query).select('_id name email status');
}

/**
 * Publish campaign, create recipients idempotently, and dispatch invitations
 */
export async function publishFeedbackCampaign(campaignId, userId, reqMeta = {}) {
  const campaign = await FeedbackCampaign.findById(campaignId).populate('form');
  if (!campaign) throw new NotFoundError('Campaign not found');

  if (campaign.status === CAMPAIGN_STATUS.CLOSED || campaign.status === CAMPAIGN_STATUS.ARCHIVED) {
    throw new BadRequestError('Cannot publish a closed or archived campaign.');
  }

  if (new Date() >= new Date(campaign.deadline)) {
    throw new BadRequestError('Cannot publish campaign: Deadline has already passed.');
  }

  if (!campaign.form || !campaign.form.questions || campaign.form.questions.length === 0) {
    throw new BadRequestError('Cannot publish campaign: Linked feedback form contains no questions.');
  }

  // Lock the form version so questions cannot mutate while active
  await FeedbackForm.updateOne({ _id: campaign.form._id }, { $set: { isLocked: true } });

  // Resolve audience
  const eligibleStudents = await resolveEligibleStudents(campaign);
  if (eligibleStudents.length === 0) {
    throw new BadRequestError('No active eligible students found matching the campaign audience criteria.');
  }

  // Idempotent bulk recipient generation
  const bulkOps = eligibleStudents.map(student => ({
    updateOne: {
      filter: { campaign: campaign._id, student: student._id },
      update: {
        $setOnInsert: {
          campaign: campaign._id,
          student: student._id,
          status: RECIPIENT_STATUS.ELIGIBLE,
          reminderCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      upsert: true
    }
  }));

  await CampaignRecipient.bulkWrite(bulkOps);

  // Update campaign status
  campaign.status = CAMPAIGN_STATUS.PUBLISHED;
  campaign.publishedAt = campaign.publishedAt || new Date();
  campaign.metrics.totalEligible = await CampaignRecipient.countDocuments({ campaign: campaign._id });
  await campaign.save();

  // Find newly eligible recipients and schedule/send initial invitations
  const pendingInvitations = await CampaignRecipient.find({
    campaign: campaign._id,
    status: RECIPIENT_STATUS.ELIGIBLE
  });

  for (const recipient of pendingInvitations) {
    executeSendInvitation(recipient._id).catch(err =>
      logger.warn({ err: err.message, recipientId: recipient._id }, 'Async invitation send failed')
    );
  }

  await logAuditEvent({
    actor: userId,
    action: 'campaign:publish',
    resourceType: 'FeedbackCampaign',
    resourceId: campaign._id,
    requestId: reqMeta.requestId,
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent,
    metadata: {
      eligibleStudentCount: eligibleStudents.length,
      formVersion: campaign.formVersion
    }
  });

  return campaign;
}

/**
 * Close an active campaign
 */
export async function closeFeedbackCampaign(campaignId, userId, reqMeta = {}) {
  const campaign = await FeedbackCampaign.findById(campaignId);
  if (!campaign) throw new NotFoundError('Campaign not found');

  campaign.status = CAMPAIGN_STATUS.CLOSED;
  campaign.closedAt = new Date();
  await campaign.save();

  await logAuditEvent({
    actor: userId,
    action: 'campaign:close',
    resourceType: 'FeedbackCampaign',
    resourceId: campaign._id,
    requestId: reqMeta.requestId,
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent
  });

  return campaign;
}

export async function getCampaignById(campaignId) {
  const campaign = await FeedbackCampaign.findById(campaignId)
    .populate('form')
    .populate('targetDepartment', 'name code')
    .populate('targetCourse', 'name code')
    .populate('targetFaculty', 'displayName email designation employeeId')
    .populate('createdBy', 'name email');

  if (!campaign) throw new NotFoundError('Feedback campaign not found');
  return campaign;
}

export async function listCampaigns({ status, department, faculty, page = 1, limit = 20 }) {
  const query = {};
  if (status) query.status = status;
  if (department) query.targetDepartment = department;
  if (faculty) query.targetFaculty = faculty;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    FeedbackCampaign.find(query)
      .populate('targetDepartment', 'name code')
      .populate('targetCourse', 'name code')
      .populate('targetFaculty', 'displayName designation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FeedbackCampaign.countDocuments(query)
  ]);

  return { items, total, page, limit };
}
