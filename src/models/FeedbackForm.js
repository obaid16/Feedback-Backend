import mongoose from 'mongoose';
import { ALL_QUESTION_TYPES, QUESTION_TYPES } from '../constants/questionTypes.js';
import { FORM_STATUS } from '../constants/campaignStatus.js';

const questionOptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    score: { type: Number, default: 0 }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true
    },
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      maxlength: 500
    },
    type: {
      type: String,
      enum: ALL_QUESTION_TYPES,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    isRequired: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    },
    category: {
      type: String,
      trim: true,
      default: 'General'
    },
    options: [questionOptionSchema],
    scaleMin: {
      type: Number,
      default: 1
    },
    scaleMax: {
      type: Number,
      default: 5
    },
    scaleLabels: {
      min: { type: String, default: 'Strongly Disagree' },
      max: { type: String, default: 'Strongly Agree' }
    }
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 0 }
  },
  { _id: false }
);

const feedbackFormSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Form title is required'],
      trim: true,
      maxlength: 150
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    version: {
      type: Number,
      default: 1,
      min: 1
    },
    status: {
      type: String,
      enum: Object.values(FORM_STATUS),
      default: FORM_STATUS.DRAFT,
      index: true
    },
    sections: [sectionSchema],
    questions: [questionSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    aiMetadata: {
      isAiGenerated: { type: Boolean, default: false },
      promptContext: { type: mongoose.Schema.Types.Mixed },
      generatedAt: { type: Date }
    },
    isLocked: {
      type: Boolean,
      default: false // Set to true once a campaign has received submissions to prevent schema mutation
    }
  },
  {
    timestamps: true
  }
);

feedbackFormSchema.index({ title: 1, version: 1 }, { unique: true });

export const FeedbackForm = mongoose.model('FeedbackForm', feedbackFormSchema);
