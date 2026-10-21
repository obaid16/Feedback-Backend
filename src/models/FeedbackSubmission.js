import mongoose from 'mongoose';
import { ALL_ANONYMITY_MODES, ANONYMITY_MODE } from '../constants/campaignStatus.js';

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true
    },
    questionType: {
      type: String,
      default: 'likert_scale'
    },
    category: {
      type: String,
      default: 'General'
    },
    ratingValue: {
      type: Number
    },
    textValue: {
      type: String,
      maxlength: 2000
    },
    selectedOptions: [{
      type: String
    }],
    booleanValue: {
      type: Boolean
    }
  },
  { _id: false }
);

const feedbackSubmissionSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedbackCampaign',
      required: [true, 'Campaign reference is required'],
      index: true
    },
    form: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedbackForm',
      required: true
    },
    formVersion: {
      type: Number,
      required: true
    },
    targetFaculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyProfile',
      index: true
    },
    targetCourse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      index: true
    },
    anonymityMode: {
      type: String,
      enum: ALL_ANONYMITY_MODES,
      default: ANONYMITY_MODE.ANONYMOUS,
      index: true
    },
    // ONLY stored if anonymityMode === 'identified', strictly omitted/null for 'anonymous'
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    // Cryptographic submission receipt token hash (never maps to student in anonymous mode)
    receiptHash: {
      type: String,
      sparse: true,
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'submitted'],
      default: 'submitted',
      index: true
    },
    answers: {
      type: [answerSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Submission must contain at least one answer'
      }
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for report aggregations without exposing individual submission timestamps
feedbackSubmissionSchema.index({ campaign: 1, targetFaculty: 1, status: 1 });

export const FeedbackSubmission = mongoose.model('FeedbackSubmission', feedbackSubmissionSchema);
