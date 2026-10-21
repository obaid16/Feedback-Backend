import { Router } from 'express';
import {
  getDepartments,
  getDepartment,
  addDepartment,
  editDepartment
} from '../controllers/department.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// Public or student-accessible department listing
router.get('/', authenticate, getDepartments);
router.get('/:id', authenticate, getDepartment);

// Administrative modification
router.post('/', authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), addDepartment);
router.patch('/:id', authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), editDepartment);

export default router;
