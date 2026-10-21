import { Router } from 'express';
import {
  getOverviewStats,
  getCampaignStats,
  getDepartmentStats,
  getFacultyStats
} from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

router.use(authenticate);
router.use(requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));

router.get('/overview', getOverviewStats);
router.get('/campaigns/:campaignId', getCampaignStats);
router.get('/departments', getDepartmentStats);
router.get('/faculty/:facultyId', getFacultyStats);

export default router;
