import { FeedbackSubmission } from '../models/FeedbackSubmission.js';
import { CampaignRecipient } from '../models/CampaignRecipient.js';
import { FeedbackCampaign } from '../models/FeedbackCampaign.js';
import { FeedbackForm } from '../models/FeedbackForm.js';
import { User } from '../models/User.js';
import { CAMPAIGN_STATUS, RECIPIENT_STATUS, ANONYMITY_MODE } from '../constants/campaignStatus.js';
import { QUESTION_TYPES } from '../constants/questionTypes.js';
import { generateRandomToken, hashToken } from '../utils/crypto.js';
import { sendSubmissionConfirmation } from './email/email.service.js';
import { logAuditEvent } from './audit.service.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError
} from '../utils/errors.js';
import { logger } from '../config/logger.js';

/**
 * List all campaigns assigned to the student with personal completion status
 */
export async function listStudentCampaigns(studentId) {
  const recipients = await CampaignRecipient.find({ student: studentId })
    .populate({
      path: 'campaign',
      populate: [
        { path: 'targetCourse', select: 'name code' },
        { path: 'targetFaculty', select: 'displayName designation' },
        { path: 'targetDepartment', select: 'name code' }
      ]
    })
    .sort({ createdAt: -1 })
    .lean();

  return recipients
    .filter(r => r.campaign && r.campaign.status !== CAMPAIGN_STATUS.DRAFT && r.campaign.status !== CAMPAIGN_STATUS.ARCHIVED)
    .map(r => {
      const c = r.campaign;
      const isExpired = new Date() > new Date(c.deadline);
      return {
        campaignId: c._id,
        title: c.title,
        description: c.description,
        purpose: c.purpose,
        startDate: c.startDate,
        deadline: c.deadline,
        isExpired,
        course: c.targetCourse,
        faculty: c.targetFaculty,
        department: c.targetDepartment,
        anonymityMode: c.anonymity?.mode || ANONYMITY_MODE.ANONYMOUS,
        disclosedPolicy: c.anonymity?.disclosedPolicy,
        myStatus: r.status,
        isSubmitted: r.status === RECIPIENT_STATUS.SUBMITTED,
        submittedAt: r.submittedAt,
        hasSavedDraft: !!(r.savedDraft?.answers?.length > 0)
      };
    });
}

/**
 * Get campaign feedback form for student with draft resumption
 */
export async function getCampaignFormForStudent(campaignId, studentId) {
  const [recipient, campaign] = await Promise.all([
    CampaignRecipient.findOne({ campaign: campaignId, student: studentId }),
    FeedbackCampaign.findById(campaignId)
      .populate('form')
      .populate('targetCourse', 'name code')
      .populate('targetFaculty', 'displayName designation')
  ]);

  if (!recipient) {
    throw new ForbiddenError('You are not assigned to participate in this feedback campaign.');
  }

  if (!campaign || campaign.status === CAMPAIGN_STATUS.DRAFT || campaign.status === CAMPAIGN_STATUS.ARCHIVED) {
    throw new NotFoundError('Campaign is currently inactive or unavailable.');
  }

  if (recipient.status === RECIPIENT_STATUS.SUBMITTED) {
    return {
      campaign: {
        id: campaign._id,
        title: campaign.title,
        deadline: campaign.deadline,
        anonymityMode: campaign.anonymity?.mode
      },
      isSubmitted: true,
      submittedAt: recipient.submittedAt,
      message: 'You have already submitted your feedback for this campaign.'
    };
  }

  return {
    campaign: {
      id: campaign._id,
      title: campaign.title,
      description: campaign.description,
      purpose: campaign.purpose,
      deadline: campaign.deadline,
      anonymityMode: campaign.anonymity?.mode,
      disclosedPolicy: campaign.anonymity?.disclosedPolicy,
      course: campaign.targetCourse,
      faculty: campaign.targetFaculty
    },
    form: {
      id: campaign.form._id,
      title: campaign.form.title,
      version: campaign.formVersion,
      sections: campaign.form.sections,
      questions: campaign.form.questions
    },
    savedDraft: recipient.savedDraft?.answers || []
  };
}

/**
 * Save draft responses for later completion
 */
export async function saveStudentDraft(campaignId, studentId, answers = []) {
  const recipient = await CampaignRecipient.findOne({ campaign: campaignId, student: studentId });
  if (!recipient) {
    throw new ForbiddenError('You are not eligible for this feedback campaign.');
  }

  if (recipient.status === RECIPIENT_STATUS.SUBMITTED) {
    throw new ConflictError('Cannot save draft: Feedback has already been submitted.');
  }

  recipient.savedDraft = {
    answers,
    lastSavedAt: new Date()
  };

  await recipient.save();
  return { success: true, savedAt: recipient.savedDraft.lastSavedAt };
}

/**
 * Validate submitted answers against the form question definitions
 */
function validateAnswersAgainstForm(answers, questions) {
  const questionsMap = new Map();
  for (const q of questions) {
    questionsMap.set(q.id, q);
  }

  const validatedAnswers = [];
  const submittedQuestionIds = new Set();

  for (const ans of answers) {
    if (!ans.questionId) {
      throw new BadRequestError('Each answer must provide a valid questionId');
    }

    const question = questionsMap.get(ans.questionId);
    if (!question) {
      throw new BadRequestError(`Answer provided for unknown question ID: ${ans.questionId}`);
    }

    submittedQuestionIds.add(ans.questionId);

    const valAns = {
      questionId: question.id,
      questionType: question.type,
      category: question.category || 'General'
    };

    switch (question.type) {
      case QUESTION_TYPES.NUMERIC_RATING:
      case QUESTION_TYPES.LIKERT_SCALE: {
        const rating = Number(ans.ratingValue);
        if (isNaN(rating) || rating < (question.scaleMin || 1) || rating > (question.scaleMax || 5)) {
          throw new BadRequestError(
            `Invalid rating for question "${question.text}". Value must be between ${question.scaleMin || 1} and ${question.scaleMax || 5}`
          );
        }
        valAns.ratingValue = rating;
        break;
      }

      case QUESTION_TYPES.SINGLE_CHOICE: {
        if (!ans.selectedOptions || ans.selectedOptions.length !== 1) {
          throw new BadRequestError(`Question "${question.text}" requires exactly one selected option`);
        }
        valAns.selectedOptions = ans.selectedOptions.map(String);
        break;
      }

      case QUESTION_TYPES.MULTIPLE_CHOICE: {
        if (!Array.isArray(ans.selectedOptions) || ans.selectedOptions.length === 0) {
          if (question.isRequired) {
            throw new BadRequestError(`Question "${question.text}" requires at least one selection`);
          }
        }
        valAns.selectedOptions = (ans.selectedOptions || []).map(String);
        break;
      }

      case QUESTION_TYPES.SHORT_TEXT:
      case QUESTION_TYPES.LONG_TEXT: {
        const text = typeof ans.textValue === 'string' ? ans.textValue.trim() : '';
        if (question.isRequired && text.length === 0) {
          throw new BadRequestError(`Question "${question.text}" is required`);
        }
        valAns.textValue = text.slice(0, 2000); // 2000 character safety limit
        break;
      }

      case QUESTION_TYPES.YES_NO: {
        if (typeof ans.booleanValue !== 'boolean') {
          throw new BadRequestError(`Question "${question.text}" requires a yes/no boolean value`);
        }
        valAns.booleanValue = ans.booleanValue;
        break;
      }

      default:
        throw new BadRequestError(`Unsupported question type: ${question.type}`);
    }

    validatedAnswers.push(valAns);
  }

  // Ensure all required questions have been answered
  for (const q of questions) {
    if (q.isRequired && !submittedQuestionIds.has(q.id)) {
      throw new BadRequestError(`Required question is missing: "${q.text}"`);
    }
  }

  return validatedAnswers;
}

/**
 * Submit final feedback with strict anonymity and concurrency safety
 */
export async function submitFeedback({
  campaignId,
  studentId,
  answers = [],
  reqMeta = {}
}) {
  const campaign = await FeedbackCampaign.findById(campaignId).populate('form');
  if (!campaign) {
    throw new NotFoundError('Campaign not found');
  }

  if (campaign.status === CAMPAIGN_STATUS.CLOSED || campaign.status === CAMPAIGN_STATUS.ARCHIVED) {
    throw new BadRequestError('This feedback campaign is closed and is no longer accepting responses.');
  }

  if (new Date() > new Date(campaign.deadline)) {
    throw new BadRequestError('Submission deadline for this campaign has expired.');
  }

  // ATOMIC CONCURRENCY CHECK:
  // We atomically update the student's recipient record from status != 'submitted' to 'submitted'.
  // This guarantees that even with multiple parallel requests, exactly one request can ever succeed!
  const updatedRecipient = await CampaignRecipient.findOneAndUpdate(
    {
      campaign: campaignId,
      student: studentId,
      status: { $ne: RECIPIENT_STATUS.SUBMITTED }
    },
    {
      $set: {
        status: RECIPIENT_STATUS.SUBMITTED,
        submittedAt: new Date()
      },
      $unset: { savedDraft: 1 }
    },
    { new: true }
  );

  if (!updatedRecipient) {
    // Check if the student already submitted or was never eligible
    const existingRecord = await CampaignRecipient.findOne({ campaign: campaignId, student: studentId });
    if (existingRecord && existingRecord.status === RECIPIENT_STATUS.SUBMITTED) {
      throw new ConflictError('You have already submitted feedback for this campaign. Duplicate submissions are strictly prevented.');
    }
    throw new ForbiddenError('You are not authorized or eligible to submit feedback for this campaign.');
  }

  // Validate all answers against the form question specifications
  const validatedAnswers = validateAnswersAgainstForm(answers, campaign.form.questions);

  // Generate anonymous receipt token
  const rawReceipt = `FBP-${generateRandomToken(4, 'hex').toUpperCase()}-${generateRandomToken(4, 'hex').toUpperCase()}`;
  const receiptHash = hashToken(rawReceipt);

  const anonymityMode = campaign.anonymity?.mode || ANONYMITY_MODE.ANONYMOUS;

  // STRICT ANONYMITY ENFORCEMENT:
  // If campaign is 'anonymous', student is physically set to null! No student identity in FeedbackSubmission.
  const submissionData = {
    campaign: campaignId,
    form: campaign.form._id,
    formVersion: campaign.formVersion,
    targetFaculty: campaign.targetFaculty,
    targetCourse: campaign.targetCourse,
    anonymityMode,
    student: anonymityMode === ANONYMITY_MODE.IDENTIFIED ? studentId : null,
    receiptHash,
    status: 'submitted',
    answers: validatedAnswers,
    submittedAt: new Date()
  };

  const submission = await FeedbackSubmission.create(submissionData);

  // Atomically increment campaign submission metrics
  await FeedbackCampaign.updateOne(
    { _id: campaignId },
    { $inc: { 'metrics.totalSubmissions': 1 } }
  );

  // Log audit event WITHOUT recording raw feedback answers to prevent correlation
  await logAuditEvent({
    actor: studentId,
    action: 'feedback:submit',
    resourceType: 'FeedbackCampaign',
    resourceId: campaignId,
    requestId: reqMeta.requestId,
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent,
    metadata: {
      anonymityMode,
      receiptHash
    }
  });

  // Dispatch confirmation email to student asynchronously
  User.findById(studentId).select('name email').then(student => {
    if (student) {
      sendSubmissionConfirmation({
        studentEmail: student.email,
        studentName: student.name,
        campaignTitle: campaign.title,
        receiptToken: rawReceipt,
        submittedAt: submission.submittedAt
      }).catch(err => logger.warn({ err }, 'Failed to send submission confirmation email'));
    }
  });

  return {
    success: true,
    message: 'Feedback submitted successfully. Your evaluation has been recorded.',
    receiptCode: rawReceipt,
    submittedAt: submission.submittedAt
  };
}
