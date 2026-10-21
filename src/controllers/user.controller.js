import {
  listUsers,
  getUserById,
  provisionUser,
  setUserStatus,
  updateUser
} from '../services/user.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export async function getUsers(req, res, next) {
  try {
    const { role, department, status, search, page = 1, limit = 20 } = req.query;
    const result = await listUsers({
      role,
      department,
      status,
      search,
      page: Number(page),
      limit: Number(limit)
    });

    return sendPaginated(res, result.items, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const user = await getUserById(req.params.id);
    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const user = await provisionUser(req.body, req.user);
    return sendSuccess(res, { user }, 'User provisioned successfully', 201);
  } catch (err) {
    next(err);
  }
}

export async function changeUserStatus(req, res, next) {
  try {
    const { status } = req.body;
    const user = await setUserStatus(req.params.id, status, req.user);
    return sendSuccess(res, { user }, `User status updated to ${status}`);
  } catch (err) {
    next(err);
  }
}

export async function updateUserDetails(req, res, next) {
  try {
    const user = await updateUser(req.params.id, req.body, req.user);
    return sendSuccess(res, { user }, 'User updated successfully');
  } catch (err) {
    next(err);
  }
}
