import mongoose from 'mongoose';

const facultyProfileSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: [true, 'Faculty email is required'],
      trim: true,
      lowercase: true,
      index: true
    },
    employeeId: {
      type: String,
      required: [true, 'Employee identifier is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
      index: true
    },
    designation: {
      type: String,
      trim: true,
      default: 'Assistant Professor'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
      index: true
    },
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
      }
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const FacultyProfile = mongoose.model('FacultyProfile', facultyProfileSchema);
