const express = require('express');
const AgreementSettingsController = require('@controllers/agreementSettings.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');

const router = express.Router();

/** Public — used on registration forms */
router.get('/public', AgreementSettingsController.getPublic);

router.use(authenticate, isSuperAdmin);

router.get('/', AgreementSettingsController.get);
router.put('/', AgreementSettingsController.upsert);

module.exports = router;
