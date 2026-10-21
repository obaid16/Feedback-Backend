import {
  createFeedbackForm,
  updateFeedbackFormDraft,
  publishFeedbackForm,
  createNewFormVersion,
  reorderQuestions,
  getFormById,
  listForms,
  archiveForm,
  validateFormQuestions
} from '../services/form.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export async function createForm(req, res, next) {
  try {
    const { title, description, sections, questions } = req.body;
    const form = await createFeedbackForm({
      title,
      description,
      sections,
      questions,
      userId: req.user._id
    });
    return sendSuccess(res, { form }, 'Feedback form created as draft', 201);
  } catch (err) {
    next(err);
  }
}

export async function getForms(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const result = await listForms({ status, page: Number(page), limit: Number(limit) });
    return sendPaginated(res, result.items, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function getForm(req, res, next) {
  try {
    const form = await getFormById(req.params.id);
    return sendSuccess(res, { form });
  } catch (err) {
    next(err);
  }
}

export async function updateForm(req, res, next) {
  try {
    const form = await updateFeedbackFormDraft(req.params.id, req.body);
    return sendSuccess(res, { form }, 'Form draft updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function reorderFormQuestions(req, res, next) {
  try {
    const { questionIds } = req.body;
    const form = await reorderQuestions(req.params.id, questionIds);
    return sendSuccess(res, { form }, 'Questions reordered successfully');
  } catch (err) {
    next(err);
  }
}

export async function validateFormDefinition(req, res, next) {
  try {
    const { questions } = req.body;
    const validated = validateFormQuestions(questions);
    return sendSuccess(res, { valid: true, questions: validated }, 'Form questions validated successfully');
  } catch (err) {
    next(err);
  }
}

export async function previewForm(req, res, next) {
  try {
    const form = await getFormById(req.params.id);
    return sendSuccess(res, {
      preview: {
        title: form.title,
        description: form.description,
        version: form.version,
        sections: form.sections,
        questions: form.questions,
        totalQuestions: form.questions.length
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function publishForm(req, res, next) {
  try {
    const form = await publishFeedbackForm(req.params.id);
    return sendSuccess(res, { form }, 'Feedback form published successfully');
  } catch (err) {
    next(err);
  }
}

export async function createNewVersion(req, res, next) {
  try {
    const form = await createNewFormVersion(req.params.id, req.user._id);
    return sendSuccess(res, { form }, `New draft version ${form.version} created`, 201);
  } catch (err) {
    next(err);
  }
}

export async function archiveFormEndpoint(req, res, next) {
  try {
    const form = await archiveForm(req.params.id);
    return sendSuccess(res, { form }, 'Feedback form archived successfully');
  } catch (err) {
    next(err);
  }
}
