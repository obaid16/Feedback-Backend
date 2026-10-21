import {
  listStudentCampaigns,
  getCampaignFormForStudent,
  saveStudentDraft,
  submitFeedback
} from '../services/submission.service.js';
import { sendSuccess } from '../utils/response.js';

export async function getStudentCampaigns(req, res, next) {
  try {
    const campaigns = await listStudentCampaigns(req.user._id);
    return sendSuccess(res, { campaigns }, 'Assigned feedback campaigns');
  } catch (err) {
    next(err);
  }
}

export async function getFormForStudent(req, res, next) {
  try {
    const data = await getCampaignFormForStudent(req.params.campaignId, req.user._id);
    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function saveDraft(req, res, next) {
  try {
    const { answers } = req.body;
    const result = await saveStudentDraft(req.params.campaignId, req.user._id, answers);
    return sendSuccess(res, result, 'Draft feedback saved successfully');
  } catch (err) {
    next(err);
  }
}

export async function submitStudentFeedback(req, res, next) {
  try {
    const { answers } = req.body;
    const result = await submitFeedback({
      campaignId: req.params.campaignId,
      studentId: req.user._id,
      answers,
      reqMeta: {
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    return sendSuccess(res, result, 'Feedback submitted successfully', 201);
  } catch (err) {
    next(err);
  }
}
