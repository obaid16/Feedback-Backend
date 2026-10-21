import {
  createFacultyProfile,
  updateFacultyProfile,
  getFacultyById,
  listFacultyProfiles
} from '../services/faculty.service.js';
import { sendSuccess } from '../utils/response.js';

export async function getFacultyList(req, res, next) {
  try {
    const { departmentId, activeOnly } = req.query;
    const faculty = await listFacultyProfiles({
      departmentId,
      activeOnly: activeOnly === 'true'
    });
    return sendSuccess(res, { faculty });
  } catch (err) {
    next(err);
  }
}

export async function getFaculty(req, res, next) {
  try {
    const faculty = await getFacultyById(req.params.id);
    return sendSuccess(res, { faculty });
  } catch (err) {
    next(err);
  }
}

export async function addFaculty(req, res, next) {
  try {
    const faculty = await createFacultyProfile(req.body);
    return sendSuccess(res, { faculty }, 'Faculty profile created successfully', 201);
  } catch (err) {
    next(err);
  }
}

export async function editFaculty(req, res, next) {
  try {
    const faculty = await updateFacultyProfile(req.params.id, req.body);
    return sendSuccess(res, { faculty }, 'Faculty profile updated successfully');
  } catch (err) {
    next(err);
  }
}
