const express = require('express');
const AffiliateSettingsController = require('@controllers/affiliateSettings.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin, isAffiliate } = require('@middlewares/authorize.middleware');

const router = express.Router();

router.get('/public', AffiliateSettingsController.getPublic);

router.get('/me', authenticate, isAffiliate, AffiliateSettingsController.getMine);

router.get('/', authenticate, isSuperAdmin, AffiliateSettingsController.get);
router.put('/', authenticate, isSuperAdmin, AffiliateSettingsController.upsert);

module.exports = router;
