import { Router } from 'express';
import { generateFormWithAI, generateReportWithAI } from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { ROLES } from '../constants/roles.js';
import { generateFormAiSchema, generateReportAiSchema } from '../validators/ai.validator.js';

const router = Router();

router.use(authenticate);
router.use(requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN));

// AI Form generation
router.post('/generate-form', aiLimiter, validate({ body: generateFormAiSchema }), generateFormWithAI);

// AI Faculty report synthesis
router.post('/reports/generate', aiLimiter, validate({ body: generateReportAiSchema }), generateReportWithAI);

export default router;
