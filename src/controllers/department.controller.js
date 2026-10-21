import {
  createDepartment,
  updateDepartment,
  getDepartmentById,
  listDepartments
} from '../services/department.service.js';
import { sendSuccess } from '../utils/response.js';

export async function getDepartments(req, res, next) {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const departments = await listDepartments({ activeOnly });
    return sendSuccess(res, { departments });
  } catch (err) {
    next(err);
  }
}

export async function getDepartment(req, res, next) {
  try {
    const department = await getDepartmentById(req.params.id);
    return sendSuccess(res, { department });
  } catch (err) {
    next(err);
  }
}

export async function addDepartment(req, res, next) {
  try {
    const department = await createDepartment(req.body);
    return sendSuccess(res, { department }, 'Department created successfully', 201);
  } catch (err) {
    next(err);
  }
}

export async function editDepartment(req, res, next) {
  try {
    const department = await updateDepartment(req.params.id, req.body);
    return sendSuccess(res, { department }, 'Department updated successfully');
  } catch (err) {
    next(err);
  }
}
