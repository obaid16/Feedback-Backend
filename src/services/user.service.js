import { User } from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { hashPassword } from '../utils/crypto.js';
import { normalizeEmail } from '../utils/sanitization.js';
import { logAuditEvent } from './audit.service.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} from '../utils/errors.js';

export async function listUsers({ role, department, status, search, page = 1, limit = 20 }) {
  const query = {};
  if (role) query.role = role;
  if (department) query.department = department;
  if (status) query.status = status;

  if (search && typeof search === 'string') {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { studentId: { $regex: escaped, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(query)
      .populate('department', 'name code')
      .populate('course', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query)
  ]);

  return { items, total, page, limit };
}

export async function getUserById(id) {
  const user = await User.findById(id)
    .populate('department', 'name code')
    .populate('course', 'name code')
    .populate('facultyAssignments', 'displayName employeeId');
  if (!user) throw new NotFoundError('User not found');
  return user;
}

/**
 * Provision new user (Students or Administrators)
 */
export async function provisionUser(userData, actor) {
  const normalized = normalizeEmail(userData.email);

  // Security check: Only SUPER_ADMIN can provision ADMIN or SUPER_ADMIN users
  if ((userData.role === ROLES.ADMIN || userData.role === ROLES.SUPER_ADMIN) && actor.role !== ROLES.SUPER_ADMIN) {
    throw new ForbiddenError('Only super-administrators are permitted to provision administrator accounts.');
  }

  const existing = await User.findOne({ email: normalized });
  if (existing) {
    throw new ConflictError('A user with this email address already exists.');
  }

  let passwordHash = undefined;
  if (userData.password) {
    passwordHash = await hashPassword(userData.password);
  }

  const user = await User.create({
    name: userData.name.trim(),
    email: normalized,
    passwordHash,
    authProvider: userData.authProvider || (userData.password ? 'local' : 'google'),
    role: userData.role || ROLES.STUDENT,
    status: 'active',
    studentId: userData.studentId?.trim(),
    department: userData.departmentId || null,
    course: userData.courseId || null,
    cohort: userData.cohort?.trim(),
    customPermissions: userData.customPermissions || []
  });

  await logAuditEvent({
    actor: actor._id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'user:provision',
    resourceType: 'User',
    resourceId: user._id,
    metadata: { assignedRole: user.role, email: user.email }
  });

  return user;
}

/**
 * Toggle user active/disabled status and invalidate sessions immediately
 */
export async function setUserStatus(userId, status, actor) {
  if (!['active', 'disabled', 'suspended'].includes(status)) {
    throw new BadRequestError('Invalid status value.');
  }

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  // Prevent admin from disabling themselves
  if (user._id.toString() === actor._id.toString()) {
    throw new BadRequestError('You cannot disable your own administrator account.');
  }

  // Prevent regular admin from modifying super_admin accounts
  if (user.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    throw new ForbiddenError('Cannot modify status of a super-administrator.');
  }

  user.status = status;
  // Administrative revocation: increment tokenVersion to invalidate existing cookies/JWTs immediately!
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  await logAuditEvent({
    actor: actor._id,
    action: `user:status_${status}`,
    resourceType: 'User',
    resourceId: user._id,
    metadata: { previousStatus: user.status, newStatus: status }
  });

  return user;
}

export async function updateUser(userId, updateData, actor) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  if (updateData.role && updateData.role !== user.role) {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only super-administrators can modify user roles.');
    }
    user.role = updateData.role;
    // Invalidate sessions on role change
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }

  if (updateData.name) user.name = updateData.name.trim();
  if (updateData.departmentId !== undefined) user.department = updateData.departmentId || null;
  if (updateData.courseId !== undefined) user.course = updateData.courseId || null;
  if (updateData.cohort !== undefined) user.cohort = updateData.cohort?.trim();
  if (updateData.studentId !== undefined) user.studentId = updateData.studentId?.trim();
  if (updateData.customPermissions && actor.role === ROLES.SUPER_ADMIN) {
    user.customPermissions = updateData.customPermissions;
  }

  await user.save();
  return user;
}
