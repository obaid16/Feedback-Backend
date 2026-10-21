import { Router } from 'express';
import {
  createForm,
  getForms,
  getForm,
  updateForm,
  reorderFormQuestions,
  validateFormDefinition,
  previewForm,
  publishForm,
  createNewVersion,
  archiveFormEndpoint
} from '../controllers/form.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../constants/roles.js';
import {
  createFormSchema,
  updateFormSchema,
  reorderQuestionsSchema
} from '../validators/form.validator.js';

const router = Router();

router.use(authenticate);

// Listing & fetching forms
router.get('/', getForms);
router.get('/:id', getForm);
router.get('/:id/preview', previewForm);

// Form authoring & mutation (Admins only)
router.post('/', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), validate({ body: createFormSchema }), createForm);
router.patch('/:id', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), validate({ body: updateFormSchema }), updateForm);
router.post('/:id/reorder', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), validate({ body: reorderQuestionsSchema }), reorderFormQuestions);
router.post('/validate', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), validateFormDefinition);
router.post('/:id/publish', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), publishForm);
router.post('/:id/version', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), createNewVersion);
router.post('/:id/archive', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), archiveFormEndpoint);

export default router;
