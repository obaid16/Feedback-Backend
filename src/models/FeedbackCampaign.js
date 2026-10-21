import mongoose from 'mongoose';
import { ALL_CAMPAIGN_STATUSES, CAMPAIGN_STATUS, ALL_ANONYMITY_MODES, ANONYMITY_MODE } from '../constants/campaignStatus.js';

const feedbackCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Campaign title is required'],
      trim: true,
      maxlength: 150
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    purpose: {
      type: String,
      trim: true,
      default: 'Semester End Faculty Feedback'
    },
    form: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedbackForm',
      required: [true, 'Feedback form reference is required'],
      index: true
    },
    formVersion: {
      type: Number,
      required: true,
      default: 1
    },
    targetDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    targetCourse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    },
    targetFaculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyProfile',
      index: true
    },
    audience: {
      cohorts: [{ type: String, trim: true }],
      departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
      courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
      explicitStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
      index: true
    },
    status: {
      type: String,
      enum: ALL_CAMPAIGN_STATUSES,
      default: CAMPAIGN_STATUS.DRAFT,
      index: true
    },
    anonymity: {
      mode: {
        type: String,
        enum: ALL_ANONYMITY_MODES,
        default: ANONYMITY_MODE.ANONYMOUS
      },
      disclosedPolicy: {
        type: String,
        default: 'Student feedback is strictly anonymous. Identifiers are physically decoupled from response contents.'
      },
      minResponsesForReport: {
        type: Number,
        default: 5
      }
    },
    reminders: {
      enabled: { type: Boolean, default: true },
      firstReminderHours: { type: Number, default: 48 },
      secondReminderHours: { type: Number, default: 96 },
      adminEscalationHours: { type: Number, default: 120 }
    },
    metrics: {
      totalEligible: { type: Number, default: 0 },
      totalSubmissions: { type: Number, default: 0 },
      responseRate: { type: Number, default: 0 }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    publishedAt: { type: Date },
    closedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Indexes for query optimization
feedbackCampaignSchema.index({ status: 1, deadline: 1 });
feedbackCampaignSchema.index({ targetFaculty: 1, status: 1 });

export const FeedbackCampaign = mongoose.model('FeedbackCampaign', feedbackCampaignSchema);
