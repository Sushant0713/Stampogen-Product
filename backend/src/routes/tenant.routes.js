const express = require('express');
const TenantController = require('@controllers/tenant.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin, isAdminOrSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const {
  createTenantValidator,
  updateTenantValidator,
  changePlanValidator,
  tenantIdValidator,
} = require('@validators/tenant.validator');

const router = express.Router();

router.use(authenticate);

router.post('/', isSuperAdmin, createTenantValidator, validate, TenantController.create);
router.get('/stats', isSuperAdmin, TenantController.getStats);
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
router.delete('/:id', isSuperAdmin, tenantIdValidator, validate, TenantController.remove);

module.exports = router;
