import { Department } from '../models/Department.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

export async function createDepartment({ name, code, description, isActive = true }) {
  const existing = await Department.findOne({ code: code.trim().toUpperCase() });
  if (existing) {
    throw new ConflictError(`Department with code "${code}" already exists.`);
  }

  return Department.create({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    description: description?.trim(),
    isActive
  });
}

export async function updateDepartment(id, { name, description, isActive }) {
  const dept = await Department.findById(id);
  if (!dept) throw new NotFoundError('Department not found');

  if (name) dept.name = name.trim();
  if (description !== undefined) dept.description = description?.trim();
  if (isActive !== undefined) dept.isActive = isActive;

  await dept.save();
  return dept;
}

export async function getDepartmentById(id) {
  const dept = await Department.findById(id);
  if (!dept) throw new NotFoundError('Department not found');
  return dept;
}

export async function listDepartments({ activeOnly = false } = {}) {
  const query = activeOnly ? { isActive: true } : {};
  return Department.find(query).sort({ name: 1 }).lean();
}
