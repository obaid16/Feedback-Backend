import {
  createCourse,
  updateCourse,
  getCourseById,
  listCourses
} from '../services/course.service.js';
import { sendSuccess } from '../utils/response.js';

export async function getCourses(req, res, next) {
  try {
    const { departmentId, cohort, activeOnly } = req.query;
    const courses = await listCourses({
      departmentId,
      cohort,
      activeOnly: activeOnly === 'true'
    });
    return sendSuccess(res, { courses });
  } catch (err) {
    next(err);
  }
}

export async function getCourse(req, res, next) {
  try {
    const course = await getCourseById(req.params.id);
    return sendSuccess(res, { course });
  } catch (err) {
    next(err);
  }
}

export async function addCourse(req, res, next) {
  try {
    const course = await createCourse(req.body);
    return sendSuccess(res, { course }, 'Course created successfully', 201);
  } catch (err) {
    next(err);
  }
}

export async function editCourse(req, res, next) {
  try {
    const course = await updateCourse(req.params.id, req.body);
    return sendSuccess(res, { course }, 'Course updated successfully');
  } catch (err) {
    next(err);
  }
}
