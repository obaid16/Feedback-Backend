import { Router } from 'express';
import {
  getStudentCampaigns,
  getFormForStudent,
  saveDraft,
  submitStudentFeedback
} from '../controllers/submission.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { submissionLimiter } from '../middleware/rateLimiter.js';
import { ROLES } from '../constants/roles.js';
import { submitFeedbackSchema, saveDraftSchema } from '../validators/submission.validator.js';

const router = Router();

router.use(authenticate);

// Student campaigns listing
router.get('/my-campaigns', requireRole(ROLES.STUDENT), getStudentCampaigns);

// Form retrieval for an assigned campaign
router.get('/campaigns/:campaignId/form', requireRole(ROLES.STUDENT), getFormForStudent);

// Save in-progress draft answers
router.post('/campaigns/:campaignId/draft', requireRole(ROLES.STUDENT), validate({ body: saveDraftSchema }), saveDraft);

// Submit finalized feedback
router.post(
  '/campaigns/:campaignId/submit',
  requireRole(ROLES.STUDENT),
  submissionLimiter,
  validate({ body: submitFeedbackSchema }),
  submitStudentFeedback
);

export default router;
