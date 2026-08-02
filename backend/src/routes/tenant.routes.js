const express = require('express');
const TenantController = require('@controllers/tenant.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin, isAdminOrSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const {
  createTenantValidator,
  updateTenantValidator,
  changePlanValidator,
  grantTrialValidator,
  extendTrialValidator,
  trialReportsValidator,
  tenantIdValidator,
} = require('@validators/tenant.validator');

const router = express.Router();

router.use(authenticate);

router.post('/', isSuperAdmin, createTenantValidator, validate, TenantController.create);
router.get('/stats', isSuperAdmin, TenantController.getStats);
router.get(
  '/trial-reports',
  isSuperAdmin,
  trialReportsValidator,
  validate,
  TenantController.trialReports
);
router.get('/', isSuperAdmin, TenantController.getAll);
router.get('/:id', isAdminOrSuperAdmin, tenantIdValidator, validate, TenantController.getById);
router.patch('/:id', isSuperAdmin, updateTenantValidator, validate, TenantController.update);
router.patch(
  '/:id/plan',
  isSuperAdmin,
  changePlanValidator,
  validate,
  TenantController.changePlan
);
router.post(
  '/:id/trial',
  isSuperAdmin,
  grantTrialValidator,
  validate,
  TenantController.grantTrial
);
router.post(
  '/:id/trial/extend',
  isSuperAdmin,
  extendTrialValidator,
  validate,
  TenantController.extendTrial
);
router.delete('/:id', isSuperAdmin, tenantIdValidator, validate, TenantController.remove);

module.exports = router;
