const express = require('express');
const AffiliateEarningsController = require('@controllers/affiliateEarnings.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isAffiliate } = require('@middlewares/authorize.middleware');

const router = express.Router();

router.use(authenticate, isAffiliate);

router.get('/summary', AffiliateEarningsController.getSummary);
router.get('/redeems', AffiliateEarningsController.listRedeems);
router.post('/redeem', AffiliateEarningsController.redeem);

module.exports = router;
