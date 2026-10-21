import { FeedbackCampaign } from '../models/FeedbackCampaign.js';
import { FeedbackSubmission } from '../models/FeedbackSubmission.js';
import { CampaignRecipient } from '../models/CampaignRecipient.js';
import { User } from '../models/User.js';
import { FacultyProfile } from '../models/FacultyProfile.js';
import { Department } from '../models/Department.js';
import { FacultyReport } from '../models/FacultyReport.js';
import { ROLES } from '../constants/roles.js';
import { RECIPIENT_STATUS, CAMPAIGN_STATUS } from '../constants/campaignStatus.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * High-level institutional dashboard summary
 */
export async function getAdminOverview() {
  const [
    totalStudents,
    totalFaculty,
    totalDepartments,
    activeCampaigns,
    totalCampaigns,
    totalSubmissions,
    totalEligibleRecipients
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.STUDENT, status: 'active' }),
    FacultyProfile.countDocuments({ isActive: true }),
    Department.countDocuments({ isActive: true }),
    FeedbackCampaign.countDocuments({ status: { $in: [CAMPAIGN_STATUS.PUBLISHED, CAMPAIGN_STATUS.ACTIVE] } }),
    FeedbackCampaign.countDocuments(),
    FeedbackSubmission.countDocuments({ status: 'submitted' }),
    CampaignRecipient.countDocuments()
  ]);

  const overallResponseRate = totalEligibleRecipients > 0
    ? Math.round((totalSubmissions / totalEligibleRecipients) * 100)
    : 0;

  // Compute institutional average rating from completed reports
  const completedReports = await FacultyReport.find({ status: 'completed' }).select('quantitativeStats.overallAverageRating').lean();
  let avgSum = 0;
  let reportCount = 0;
  for (const rep of completedReports) {
    if (rep.quantitativeStats?.overallAverageRating > 0) {
      avgSum += rep.quantitativeStats.overallAverageRating;
      reportCount++;
    }
  }

  const institutionalAverageRating = reportCount > 0 ? Number((avgSum / reportCount).toFixed(2)) : 0;

  return {
    metrics: {
      totalStudents,
      totalFaculty,
      totalDepartments,
      activeCampaigns,
      totalCampaigns,
      totalSubmissions,
      overallResponseRate,
      institutionalAverageRating
    }
  };
}

/**
 * Granular campaign completion and question-level analytics
 */
export async function getCampaignAnalytics(campaignId) {
  const campaign = await FeedbackCampaign.findById(campaignId)
    .populate('form')
    .populate('targetFaculty', 'displayName')
    .populate('targetCourse', 'name code');

  if (!campaign) throw new NotFoundError('Campaign not found');

  const [totalEligible, submittedCount, invitedCount, reminder1Count, reminder2Count, escalatedCount] = await Promise.all([
    CampaignRecipient.countDocuments({ campaign: campaignId }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.SUBMITTED }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.INVITED }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.REMINDER_1_SENT }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.REMINDER_2_SENT }),
    CampaignRecipient.countDocuments({ campaign: campaignId, status: RECIPIENT_STATUS.ESCALATED_ADMIN })
  ]);

  const submissions = await FeedbackSubmission.find({ campaign: campaignId, status: 'submitted' }).lean();

  // Question-level aggregates
  const questionAggregates = {};
  for (const q of campaign.form?.questions || []) {
    questionAggregates[q.id] = {
      id: q.id,
      text: q.text,
      type: q.type,
      category: q.category,
      totalResponses: 0,
      averageRating: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      optionsCount: {}
    };
  }

  let totalRatingSum = 0;
  let totalRatingItems = 0;

  for (const sub of submissions) {
    for (const ans of sub.answers || []) {
      const agg = questionAggregates[ans.questionId];
      if (!agg) continue;

      agg.totalResponses++;

      if (typeof ans.ratingValue === 'number') {
        const r = Math.round(ans.ratingValue);
        if (agg.distribution[r] !== undefined) {
          agg.distribution[r]++;
        }
        totalRatingSum += ans.ratingValue;
        totalRatingItems++;
      }

      if (Array.isArray(ans.selectedOptions)) {
        for (const opt of ans.selectedOptions) {
          agg.optionsCount[opt] = (agg.optionsCount[opt] || 0) + 1;
        }
      }
    }
  }

  // Finalize question averages
  for (const agg of Object.values(questionAggregates)) {
    if (agg.type === 'numeric_rating' || agg.type === 'likert_scale') {
      let sum = 0;
      let count = 0;
      for (let r = 1; r <= 5; r++) {
        sum += r * (agg.distribution[r] || 0);
        count += (agg.distribution[r] || 0);
      }
      agg.averageRating = count > 0 ? Number((sum / count).toFixed(2)) : 0;
    }
  }

  return {
    campaign: {
      id: campaign._id,
      title: campaign.title,
      status: campaign.status,
      deadline: campaign.deadline,
      course: campaign.targetCourse,
      faculty: campaign.targetFaculty
    },
    completion: {
      totalEligible,
      submitted: submittedCount,
      pending: totalEligible - submittedCount,
      responseRatePercentage: totalEligible > 0 ? Math.round((submittedCount / totalEligible) * 100) : 0,
      breakdown: {
        invited: invitedCount,
        reminder1Sent: reminder1Count,
        reminder2Sent: reminder2Count,
        escalatedToAdmin: escalatedCount
      }
    },
    questionAggregates: Object.values(questionAggregates)
  };
}

/**
 * Response rate aggregated by academic department
 */
export async function getDepartmentResponseRates() {
  const departments = await Department.find({ isActive: true }).select('name code').lean();

  const results = [];
  for (const dept of departments) {
    const [eligibleCount, studentCount] = await Promise.all([
      CampaignRecipient.countDocuments(),
      User.countDocuments({ role: ROLES.STUDENT, department: dept._id })
    ]);

    const campaigns = await FeedbackCampaign.find({ targetDepartment: dept._id }).select('_id metrics');
    let totalSubs = 0;
    let totalEligible = 0;
    for (const c of campaigns) {
      totalSubs += (c.metrics?.totalSubmissions || 0);
      totalEligible += (c.metrics?.totalEligible || 0);
    }

    results.push({
      departmentId: dept._id,
      name: dept.name,
      code: dept.code,
      totalStudents: studentCount,
      totalCampaigns: campaigns.length,
      totalSubmissions: totalSubs,
      responseRatePercentage: totalEligible > 0 ? Math.round((totalSubs / totalEligible) * 100) : 0
    });
  }

  return results;
}

/**
 * Historical rating trends for an individual faculty member
 */
export async function getFacultyTrends(facultyId) {
  const faculty = await FacultyProfile.findById(facultyId).select('displayName email designation');
  if (!faculty) throw new NotFoundError('Faculty profile not found');

  const reports = await FacultyReport.find({ faculty: facultyId, status: 'completed' })
    .populate('campaign', 'title deadline')
    .sort({ createdAt: 1 })
    .lean();

  const history = reports.map(r => ({
    reportId: r._id,
    campaignTitle: r.campaign?.title || 'Unknown Campaign',
    reportingPeriod: r.reportingPeriod,
    version: r.version,
    overallAverageRating: r.quantitativeStats?.overallAverageRating || 0,
    totalResponses: r.quantitativeStats?.totalResponses || 0,
    responseRatePercentage: r.quantitativeStats?.responseRatePercentage || 0,
    categoryScores: r.quantitativeStats?.categoryScores || [],
    generatedAt: r.generatedAt
  }));

  return {
    faculty,
    totalEvaluations: reports.length,
    history
  };
}
