import {
  getAdminOverview,
  getCampaignAnalytics,
  getDepartmentResponseRates,
  getFacultyTrends
} from '../services/analytics.service.js';
import { sendSuccess } from '../utils/response.js';

export async function getOverviewStats(req, res, next) {
  try {
    const stats = await getAdminOverview();
    return sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function getCampaignStats(req, res, next) {
  try {
    const analytics = await getCampaignAnalytics(req.params.campaignId);
    return sendSuccess(res, analytics);
  } catch (err) {
    next(err);
  }
}

export async function getDepartmentStats(req, res, next) {
  try {
    const departments = await getDepartmentResponseRates();
    return sendSuccess(res, { departments });
  } catch (err) {
    next(err);
  }
}

export async function getFacultyStats(req, res, next) {
  try {
    const trends = await getFacultyTrends(req.params.facultyId);
    return sendSuccess(res, trends);
  } catch (err) {
    next(err);
  }
}
