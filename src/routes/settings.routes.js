import { Router } from 'express';
import {
  getInstitutionalSettings,
  getSystemAuditLogs
} from '../controllers/settings.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

router.use(authenticate);

// General institutional settings
router.get('/', getInstitutionalSettings);

// Audit logs restricted to SUPER_ADMIN
router.get('/audit-logs', requireRole(ROLES.SUPER_ADMIN), getSystemAuditLogs);

export default router;
