import { Router } from 'express';
import {
  getFacultyList,
  getFaculty,
  addFaculty,
  editFaculty
} from '../controllers/faculty.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

router.use(authenticate);

router.get('/', getFacultyList);
router.get('/:id', getFaculty);

router.post('/', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), addFaculty);
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), editFaculty);

export default router;
