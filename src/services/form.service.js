import { FeedbackForm } from '../models/FeedbackForm.js';
import { FeedbackCampaign } from '../models/FeedbackCampaign.js';
import { FeedbackSubmission } from '../models/FeedbackSubmission.js';
import { FORM_STATUS } from '../constants/campaignStatus.js';
import { ALL_QUESTION_TYPES, QUESTION_TYPES } from '../constants/questionTypes.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Validate questions array thoroughly
 */
export function validateFormQuestions(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new BadRequestError('Feedback form must contain at least one question.');
  }

  const seenIds = new Set();

  questions.forEach((q, idx) => {
    if (!q.id) {
      q.id = `q_${idx + 1}_${uuidv4().substring(0, 8)}`;
    }

    if (seenIds.has(q.id)) {
      throw new BadRequestError(`Duplicate question identifier detected: "${q.id}"`);
    }
    seenIds.add(q.id);

    if (!q.text || typeof q.text !== 'string' || q.text.trim().length === 0) {
      throw new BadRequestError(`Question #${idx + 1} is missing question text.`);
    }

    if (!ALL_QUESTION_TYPES.includes(q.type)) {
      throw new BadRequestError(`Invalid question type "${q.type}" on question #${idx + 1}`);
    }

    if (q.type === QUESTION_TYPES.SINGLE_CHOICE || q.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new BadRequestError(`Choice question "${q.text}" must provide at least 2 options.`);
      }
      q.options.forEach((opt, optIdx) => {
        if (!opt.label || opt.value === undefined || opt.value === null) {
          throw new BadRequestError(`Option #${optIdx + 1} on question "${q.text}" is missing label or value.`);
        }
      });
    }

    if (q.type === QUESTION_TYPES.NUMERIC_RATING || q.type === QUESTION_TYPES.LIKERT_SCALE) {
      const min = q.scaleMin ?? 1;
      const max = q.scaleMax ?? 5;
      if (min >= max) {
        throw new BadRequestError(`Rating scale on question "${q.text}" must satisfy scaleMin < scaleMax.`);
      }
      q.scaleMin = min;
      q.scaleMax = max;
    }

    q.order = idx + 1;
  });

  return questions;
}

/**
 * Create a new draft feedback form
 */
export async function createFeedbackForm({ title, description, sections = [], questions = [], userId, aiMetadata = {} }) {
  const validatedQuestions = validateFormQuestions(questions);

  const existing = await FeedbackForm.findOne({ title: title.trim(), version: 1 });
  if (existing) {
    throw new ConflictError(`A form with title "${title}" already exists.`);
  }

  const form = await FeedbackForm.create({
    title: title.trim(),
    description: description?.trim(),
    version: 1,
    status: FORM_STATUS.DRAFT,
    sections,
    questions: validatedQuestions,
    createdBy: userId,
    aiMetadata: {
      isAiGenerated: !!aiMetadata.isAiGenerated,
      promptContext: aiMetadata.promptContext || null,
      generatedAt: aiMetadata.isAiGenerated ? new Date() : null
    }
  });

  return form;
}

/**
 * Update a draft feedback form
 */
export async function updateFeedbackFormDraft(formId, updateData) {
  const form = await FeedbackForm.findById(formId);
  if (!form) {
    throw new NotFoundError('Feedback form not found');
  }

  if (form.isLocked) {
    throw new BadRequestError('This form version is locked because it is linked to active campaign submissions. Create a new version instead.');
  }

  if (form.status === FORM_STATUS.ARCHIVED) {
    throw new BadRequestError('Archived forms cannot be edited.');
  }

  if (updateData.title) form.title = updateData.title.trim();
  if (updateData.description !== undefined) form.description = updateData.description.trim();
  if (updateData.sections) form.sections = updateData.sections;
  if (updateData.questions) {
    form.questions = validateFormQuestions(updateData.questions);
  }

  await form.save();
  return form;
}

/**
 * Publish a feedback form
 */
export async function publishFeedbackForm(formId) {
  const form = await FeedbackForm.findById(formId);
  if (!form) throw new NotFoundError('Form not found');

  if (form.questions.length === 0) {
    throw new BadRequestError('Cannot publish an empty form.');
  }

  form.status = FORM_STATUS.PUBLISHED;
  await form.save();
  return form;
}

/**
 * Create a new version of an existing form
 */
export async function createNewFormVersion(formId, userId) {
  const original = await FeedbackForm.findById(formId);
  if (!original) throw new NotFoundError('Form not found');

  const latestDoc = await FeedbackForm.findOne({ title: original.title })
    .sort({ version: -1 })
    .select('version');

  const newVersionNumber = (latestDoc?.version || 1) + 1;

  const newVersion = await FeedbackForm.create({
    title: original.title,
    description: original.description,
    version: newVersionNumber,
    status: FORM_STATUS.DRAFT,
    sections: original.sections,
    questions: original.questions,
    createdBy: userId,
    isLocked: false
  });

  return newVersion;
}

/**
 * Reorder questions in a form
 */
export async function reorderQuestions(formId, questionIds = []) {
  const form = await FeedbackForm.findById(formId);
  if (!form) throw new NotFoundError('Form not found');

  if (form.isLocked) {
    throw new BadRequestError('Cannot reorder questions in a locked form version.');
  }

  const questionMap = new Map();
  for (const q of form.questions) {
    questionMap.set(q.id, q);
  }

  const reordered = [];
  questionIds.forEach((id, idx) => {
    const q = questionMap.get(id);
    if (q) {
      q.order = idx + 1;
      reordered.push(q);
      questionMap.delete(id);
    }
  });

  // Append any questions omitted from the reorder array
  for (const remaining of questionMap.values()) {
    remaining.order = reordered.length + 1;
    reordered.push(remaining);
  }

  form.questions = reordered;
  await form.save();
  return form;
}

export async function getFormById(formId) {
  const form = await FeedbackForm.findById(formId).populate('createdBy', 'name email');
  if (!form) throw new NotFoundError('Form not found');
  return form;
}

export async function listForms({ status, page = 1, limit = 20 }) {
  const query = {};
  if (status) query.status = status;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    FeedbackForm.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    FeedbackForm.countDocuments(query)
  ]);

  return { items, total, page, limit };
}

export async function archiveForm(formId) {
  const form = await FeedbackForm.findById(formId);
  if (!form) throw new NotFoundError('Form not found');

  form.status = FORM_STATUS.ARCHIVED;
  await form.save();
  return form;
}
