import { Course } from '../models/Course.js';
import { Department } from '../models/Department.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

export async function createCourse({ name, code, departmentId, cohort, assignedFaculty = [], isActive = true }) {
  const dept = await Department.findById(departmentId);
  if (!dept) throw new NotFoundError('Department not found');

  const existing = await Course.findOne({ code: code.trim().toUpperCase(), department: departmentId });
  if (existing) {
    throw new ConflictError(`Course with code "${code}" already exists in this department.`);
  }

  return Course.create({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    department: departmentId,
    cohort: cohort?.trim(),
    assignedFaculty,
    isActive
  });
}

export async function updateCourse(id, { name, code, cohort, assignedFaculty, isActive }) {
  const course = await Course.findById(id);
  if (!course) throw new NotFoundError('Course not found');

  if (name) course.name = name.trim();
  if (code) course.code = code.trim().toUpperCase();
  if (cohort !== undefined) course.cohort = cohort?.trim();
  if (assignedFaculty) course.assignedFaculty = assignedFaculty;
  if (isActive !== undefined) course.isActive = isActive;

  await course.save();
  return course;
}

export async function getCourseById(id) {
  const course = await Course.findById(id)
    .populate('department', 'name code')
    .populate('assignedFaculty', 'displayName email designation employeeId');
  if (!course) throw new NotFoundError('Course not found');
  return course;
}

export async function listCourses({ departmentId, cohort, activeOnly = false } = {}) {
  const query = {};
  if (departmentId) query.department = departmentId;
  if (cohort) query.cohort = cohort;
  if (activeOnly) query.isActive = true;

  return Course.find(query)
    .populate('department', 'name code')
    .populate('assignedFaculty', 'displayName email designation')
    .sort({ code: 1 })
    .lean();
}
