import { Router } from 'express';
import {
  getReports,
  getReport,
  downloadReportPdf,
  regenerateReport
} from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), getReports);
router.get('/:id', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), getReport);
router.get('/:id/pdf', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), downloadReportPdf);
router.post('/:id/regenerate', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), regenerateReport);

export default router;
