import mongoose from 'mongoose';
import { ROLES, ALL_ROLES } from '../constants/roles.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    authProvider: {
      type: String,
      enum: ['google', 'local', 'both'],
      default: 'local'
    },
    googleId: {
      type: String,
      sparse: true,
      index: true
    },
    passwordHash: {
      type: String,
      select: false // Never returned in normal queries
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: ROLES.STUDENT,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'disabled', 'suspended'],
      default: 'active',
      index: true
    },
    studentId: {
      type: String,
      sparse: true,
      trim: true,
      index: true
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      index: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    },
    cohort: {
      type: String,
      trim: true // e.g. "2024-2028" or "Year 3"
    },
    facultyAssignments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FacultyProfile'
      }
    ],
    customPermissions: {
      type: [String],
      default: []
    },
    tokenVersion: {
      type: Number,
      default: 0
    },
    resetPasswordTokenHash: {
      type: String,
      select: false
    },
    resetPasswordExpiresAt: {
      type: Date,
      select: false
    },
    lastLoginAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.passwordHash;
        delete ret.resetPasswordTokenHash;
        delete ret.resetPasswordExpiresAt;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound index for department and cohort student lookups
userSchema.index({ role: 1, department: 1, status: 1 });

export const User = mongoose.model('User', userSchema);
