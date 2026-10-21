import { Router } from 'express';
import {
  createCampaign,
  getCampaigns,
  getCampaign,
  publishCampaign,
  closeCampaign,
  estimateAudience
} from '../controllers/campaign.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../constants/roles.js';
import { createCampaignSchema } from '../validators/campaign.validator.js';

const router = Router();

router.use(authenticate);

// Listing & details
router.get('/', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), getCampaigns);
router.get('/:id', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), getCampaign);
router.get('/:id/audience-estimate', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), estimateAudience);

// Creation and lifecycle controls
router.post('/', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), validate({ body: createCampaignSchema }), createCampaign);
router.post('/:id/publish', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), publishCampaign);
router.post('/:id/close', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), closeCampaign);

export default router;
