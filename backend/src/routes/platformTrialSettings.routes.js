const express = require('express');
const PlatformTrialSettingsController = require('@controllers/platformTrialSettings.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const { upsertPlatformTrialSettingsValidator } = require('@validators/platformTrialSettings.validator');

const router = express.Router();

router.get('/public', PlatformTrialSettingsController.getPublic);

router.get('/', authenticate, isSuperAdmin, PlatformTrialSettingsController.get);
router.put(
  '/',
  authenticate,
  isSuperAdmin,
  upsertPlatformTrialSettingsValidator,
  validate,
  PlatformTrialSettingsController.upsert
);

module.exports = router;
