import { Router } from 'express';
import {
  getUsers,
  getUser,
  createUser,
  changeUserStatus,
  updateUserDetails
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = Router();

router.use(authenticate);

// Listing and inspecting users requires admin access
router.get('/', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), getUsers);
router.get('/:id', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), getUser);

// Provisioning new users (Admin or Super Admin)
router.post('/', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), createUser);

// Updating user details
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), updateUserDetails);

// Modifying user status (disable/suspend/activate)
router.patch('/:id/status', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), changeUserStatus);

export default router;
