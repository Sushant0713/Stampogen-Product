const express = require('express');
const FeatureController = require('@controllers/feature.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const {
  createFeatureValidator,
  updateFeatureValidator,
  featureIdValidator,
  bulkDeleteFeatureValidator,
} = require('@validators/feature.validator');

const router = express.Router();

router.use(authenticate, isSuperAdmin);

router.get('/', FeatureController.getAll);
router.post('/', createFeatureValidator, validate, FeatureController.create);
router.post('/bulk-delete', bulkDeleteFeatureValidator, validate, FeatureController.removeMany);
router.get('/:id', featureIdValidator, validate, FeatureController.getById);
router.patch('/:id', updateFeatureValidator, validate, FeatureController.update);
router.delete('/:id', featureIdValidator, validate, FeatureController.remove);

module.exports = router;
