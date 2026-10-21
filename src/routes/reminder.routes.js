import { Router } from 'express';
import {
  getReminderOverview,
  triggerReconciliation,
  retryRecipientReminder
} from '../controllers/reminder.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

router.use(authenticate);
router.use(requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));

router.get('/campaigns/:campaignId', getReminderOverview);
router.post('/reconcile', triggerReconciliation);
router.post('/recipients/:recipientId/retry', retryRecipientReminder);

export default router;
