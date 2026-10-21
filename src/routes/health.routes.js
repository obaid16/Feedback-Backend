import { Router } from 'express';
import { healthCheck, livenessCheck } from '../controllers/health.controller.js';

const router = Router();

router.get('/', healthCheck);
router.get('/live', livenessCheck);

export default router;
