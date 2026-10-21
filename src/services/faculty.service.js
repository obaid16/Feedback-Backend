import { FacultyProfile } from '../models/FacultyProfile.js';
import { Department } from '../models/Department.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { normalizeEmail } from '../utils/sanitization.js';

export async function createFacultyProfile({
  displayName,
  email,
  employeeId,
  departmentId,
  designation = 'Assistant Professor',
  userId = null,
  courses = [],
  isActive = true
}) {
  const normalized = normalizeEmail(email);
  const dept = await Department.findById(departmentId);
  if (!dept) throw new NotFoundError('Department not found');

  const existing = await FacultyProfile.findOne({
    $or: [{ employeeId: employeeId.trim().toUpperCase() }, { email: normalized }]
  });

  if (existing) {
    throw new ConflictError('A faculty profile with this employee ID or email already exists.');
  }

  return FacultyProfile.create({
    displayName: displayName.trim(),
    email: normalized,
    employeeId: employeeId.trim().toUpperCase(),
    department: departmentId,
    designation: designation.trim(),
    user: userId || null,
    courses,
    isActive
  });
}

export async function updateFacultyProfile(id, updateData) {
  const profile = await FacultyProfile.findById(id);
  if (!profile) throw new NotFoundError('Faculty profile not found');

  if (updateData.displayName) profile.displayName = updateData.displayName.trim();
  if (updateData.designation) profile.designation = updateData.designation.trim();
  if (updateData.departmentId) profile.department = updateData.departmentId;
  if (updateData.courses) profile.courses = updateData.courses;
  if (updateData.isActive !== undefined) profile.isActive = updateData.isActive;

  await profile.save();
  return profile;
}

export async function getFacultyById(id) {
  const profile = await FacultyProfile.findById(id)
    .populate('department', 'name code')
    .populate('courses', 'name code');
  if (!profile) throw new NotFoundError('Faculty profile not found');
  return profile;
}

export async function listFacultyProfiles({ departmentId, activeOnly = false } = {}) {
  const query = {};
  if (departmentId) query.department = departmentId;
  if (activeOnly) query.isActive = true;

  return FacultyProfile.find(query)
    .populate('department', 'name code')
    .populate('courses', 'name code')
    .sort({ displayName: 1 })
    .lean();
}
