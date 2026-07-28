const express = require('express');
const PlanController = require('@controllers/plan.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const {
  createPlanValidator,
  updatePlanValidator,
  planIdValidator,
  bulkDeletePlanValidator,
} = require('@validators/plan.validator');

const router = express.Router();

router.get('/public', PlanController.getPublic);

router.use(authenticate, isSuperAdmin);

router.get('/', PlanController.getAll);
router.post('/', createPlanValidator, validate, PlanController.create);
router.post('/bulk-delete', bulkDeletePlanValidator, validate, PlanController.removeMany);
router.get('/:id', planIdValidator, validate, PlanController.getById);
router.patch('/:id', updatePlanValidator, validate, PlanController.update);
router.delete('/:id', planIdValidator, validate, PlanController.remove);

module.exports = router;
