import {
  createFeedbackCampaign,
  publishFeedbackCampaign,
  closeFeedbackCampaign,
  getCampaignById,
  listCampaigns,
  resolveEligibleStudents
} from '../services/campaign.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export async function createCampaign(req, res, next) {
  try {
    const campaign = await createFeedbackCampaign({
      ...req.body,
      userId: req.user._id
    });
    return sendSuccess(res, { campaign }, 'Campaign created as draft', 201);
  } catch (err) {
    next(err);
  }
}

export async function getCampaigns(req, res, next) {
  try {
    const { status, department, faculty, page = 1, limit = 20 } = req.query;
    const result = await listCampaigns({
      status,
      department,
      faculty,
      page: Number(page),
      limit: Number(limit)
    });
    return sendPaginated(res, result.items, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function getCampaign(req, res, next) {
  try {
    const campaign = await getCampaignById(req.params.id);
    return sendSuccess(res, { campaign });
  } catch (err) {
    next(err);
  }
}

export async function publishCampaign(req, res, next) {
  try {
    const campaign = await publishFeedbackCampaign(req.params.id, req.user._id, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    return sendSuccess(res, { campaign }, 'Campaign published and invitations dispatched');
  } catch (err) {
    next(err);
  }
}

export async function closeCampaign(req, res, next) {
  try {
    const campaign = await closeFeedbackCampaign(req.params.id, req.user._id, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    return sendSuccess(res, { campaign }, 'Campaign closed successfully');
  } catch (err) {
    next(err);
  }
}

export async function estimateAudience(req, res, next) {
  try {
    const campaign = await getCampaignById(req.params.id);
    const audience = await resolveEligibleStudents(campaign);
    return sendSuccess(res, { eligibleCount: audience.length }, 'Audience resolved');
  } catch (err) {
    next(err);
  }
}
