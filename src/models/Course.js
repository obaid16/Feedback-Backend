import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
      maxlength: 150
    },
    code: {
      type: String,
      required: [true, 'Course code is required'],
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
    cohort: {
      type: String,
      trim: true
    },
    assignedFaculty: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FacultyProfile'
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

courseSchema.index({ code: 1, department: 1 }, { unique: true });

export const Course = mongoose.model('Course', courseSchema);
