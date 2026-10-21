import { FacultyReport } from '../models/FacultyReport.js';
import { FeedbackSubmission } from '../models/FeedbackSubmission.js';
import { FeedbackCampaign } from '../models/FeedbackCampaign.js';
import { FacultyProfile } from '../models/FacultyProfile.js';
import { CampaignRecipient } from '../models/CampaignRecipient.js';
import { synthesizeFacultyFeedbackWithAI } from './ai/reportSynthesizer.js';
import { generateFacultyReportPdf } from './pdf/reportPdf.js';
import { AppError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Deterministically compute all numerical ratings and distributions on the server
 */
export function calculateDeterministicStats(submissions = [], totalEligible = 0) {
  const totalResponses = submissions.length;
  const responseRatePercentage = totalEligible > 0 ? Math.round((totalResponses / totalEligible) * 100) : 0;

  let totalScoreSum = 0;
  let totalRatingAnswersCount = 0;

  const distributionMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const categoryMap = {};
  const qualitativeComments = [];

  for (const sub of submissions) {
    for (const ans of sub.answers || []) {
      // Numerical / Likert rating scoring
      if (typeof ans.ratingValue === 'number' && ans.ratingValue >= 1 && ans.ratingValue <= 5) {
        const r = Math.round(ans.ratingValue);
        distributionMap[r] = (distributionMap[r] || 0) + 1;
        totalScoreSum += ans.ratingValue;
        totalRatingAnswersCount++;

        const cat = ans.category || 'General';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { sum: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
        }
        categoryMap[cat].sum += ans.ratingValue;
        categoryMap[cat].count++;
        categoryMap[cat].distribution[r] = (categoryMap[cat].distribution[r] || 0) + 1;
      }

      // Collect qualitative feedback
      if (ans.textValue && typeof ans.textValue === 'string' && ans.textValue.trim().length > 5) {
        qualitativeComments.push(ans.textValue.trim());
      }
    }
  }

  const overallAverageRating = totalRatingAnswersCount > 0
    ? Number((totalScoreSum / totalRatingAnswersCount).toFixed(2))
    : 0;

  const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({
    rating: r,
    count: distributionMap[r],
    percentage: totalRatingAnswersCount > 0 ? Math.round((distributionMap[r] / totalRatingAnswersCount) * 100) : 0
  }));

  const categoryScores = Object.entries(categoryMap).map(([category, data]) => ({
    category,
    averageRating: Number((data.sum / (data.count || 1)).toFixed(2)),
    totalResponses: data.count,
    distribution: [1, 2, 3, 4, 5].map(r => ({
      rating: r,
      count: data.distribution[r],
      percentage: data.count > 0 ? Math.round((data.distribution[r] / data.count) * 100) : 0
    }))
  }));

  return {
    totalEligibleStudents: totalEligible,
    totalResponses,
    responseRatePercentage,
    overallAverageRating,
    ratingDistribution,
    categoryScores,
    qualitativeComments
  };
}

/**
 * Generate or regenerate a faculty evaluation report
 */
export async function generateFacultyReport({
  campaignId,
  facultyId,
  reportingPeriod = 'Current Term',
  userId
}) {
  const [campaign, faculty] = await Promise.all([
    FeedbackCampaign.findById(campaignId).populate('targetCourse'),
    FacultyProfile.findById(facultyId).populate('department')
  ]);

  if (!campaign) throw new NotFoundError('Campaign not found');
  if (!faculty) throw new NotFoundError('Faculty profile not found');

  // Count total eligible students for this campaign
  const totalEligible = await CampaignRecipient.countDocuments({ campaign: campaignId });

  // Fetch submitted feedback responses (decoupled from student identity)
  const submissions = await FeedbackSubmission.find({
    campaign: campaignId,
    status: 'submitted',
    $or: [
      { targetFaculty: facultyId },
      { targetFaculty: null } // Campaign targeted directly
    ]
  }).lean();

  const minThreshold = campaign.anonymity?.minResponsesForReport || env.MIN_REPORT_RESPONSES || 5;

  // SMALL-SAMPLE ANONYMITY PROTECTION
  if (submissions.length < minThreshold) {
    logger.warn(
      { campaignId, facultyId, responseCount: submissions.length, minThreshold },
      'Insufficient feedback submissions to generate definitive report'
    );

    // Create an insufficient_data report record without revealing individual feedback
    const latestVersionDoc = await FacultyReport.findOne({ campaign: campaignId, faculty: facultyId })
      .sort({ version: -1 })
      .select('version');

    const nextVersion = (latestVersionDoc?.version || 0) + 1;

    const report = await FacultyReport.create({
      campaign: campaignId,
      faculty: facultyId,
      reportingPeriod,
      version: nextVersion,
      status: 'insufficient_data',
      quantitativeStats: {
        totalEligibleStudents: totalEligible,
        totalResponses: submissions.length,
        responseRatePercentage: totalEligible > 0 ? Math.round((submissions.length / totalEligible) * 100) : 0,
        overallAverageRating: 0,
        ratingDistribution: [],
        categoryScores: []
      },
      qualitativeSynthesis: {
        executiveSummary: `Report generation is withheld because received submissions (${submissions.length}) are below the institutional privacy threshold of ${minThreshold} responses.`,
        teachingStrengths: [],
        improvementOpportunities: [],
        recurringThemes: [],
        studentSentimentSummary: 'Insufficient data for qualitative analysis.',
        actionableRecommendations: [
          'Encourage higher student participation before concluding the evaluation campaign.'
        ],
        evidenceSummaries: [],
        limitations: [
          `Threshold protection active: Minimum ${minThreshold} responses required to prevent individual student re-identification.`
        ]
      },
      aiMetadata: {
        modelUsed: 'threshold-suppression',
        tokensUsed: 0,
        generationLatencyMs: 0,
        confidenceScore: 'insufficient'
      },
      generatedBy: userId,
      generatedAt: new Date()
    });

    return report;
  }

  // 1. Compute deterministic numerical statistics
  const { qualitativeComments, ...quantitativeStats } = calculateDeterministicStats(submissions, totalEligible);

  // 2. Synthesize qualitative report using OpenAI
  const { synthesis, metadata } = await synthesizeFacultyFeedbackWithAI({
    facultyName: faculty.displayName,
    courseName: campaign.targetCourse?.name || 'Assigned Course',
    reportingPeriod,
    quantitativeStats,
    qualitativeComments
  });

  // 3. Determine next version
  const latestDoc = await FacultyReport.findOne({ campaign: campaignId, faculty: facultyId })
    .sort({ version: -1 })
    .select('version');

  const version = (latestDoc?.version || 0) + 1;

  // 4. Save FacultyReport
  const report = await FacultyReport.create({
    campaign: campaignId,
    faculty: facultyId,
    reportingPeriod,
    version,
    status: 'completed',
    quantitativeStats,
    qualitativeSynthesis: synthesis,
    aiMetadata: metadata,
    generatedBy: userId,
    generatedAt: new Date()
  });

  // 5. Generate and store PDF
  try {
    const { filePath } = await generateFacultyReportPdf(report, faculty, campaign, campaign.targetCourse);
    report.pdfFilePath = filePath;
    await report.save();
  } catch (pdfErr) {
    logger.error({ err: pdfErr }, 'Failed to generate PDF for faculty report');
  }

  return report;
}

export async function getReportById(reportId) {
  const report = await FacultyReport.findById(reportId)
    .populate('faculty', 'displayName email department employeeId')
    .populate('campaign', 'title deadline targetCourse')
    .populate('generatedBy', 'name email');

  if (!report) {
    throw new NotFoundError('Faculty report not found');
  }

  return report;
}

export async function listFacultyReports({ campaignId, facultyId, page = 1, limit = 10 }) {
  const query = {};
  if (campaignId) query.campaign = campaignId;
  if (facultyId) query.faculty = facultyId;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    FacultyReport.find(query)
      .populate('faculty', 'displayName email employeeId')
      .populate('campaign', 'title status deadline')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FacultyReport.countDocuments(query)
  ]);

  return { items, total, page, limit };
}
