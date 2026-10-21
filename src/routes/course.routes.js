import { Router } from 'express';
import {
  getCourses,
  getCourse,
  addCourse,
  editCourse
} from '../controllers/course.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

router.use(authenticate);

router.get('/', getCourses);
router.get('/:id', getCourse);

// Admin-only mutation
router.post('/', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), addCourse);
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), editCourse);

export default router;
