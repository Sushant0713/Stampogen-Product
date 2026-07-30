const express = require('express');
const { param, body } = require('express-validator');
const AffiliateEarningsController = require('@controllers/affiliateEarnings.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isAffiliate, isSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/admin/redeems', isSuperAdmin, AffiliateEarningsController.listAllRedeems);

router.post(
  '/admin/redeems/:id/paid',
  isSuperAdmin,
  [param('id').isMongoId().withMessage('Invalid redeem id')],
  validate,
  AffiliateEarningsController.markPaid
);

router.post(
  '/admin/redeems/:id/reject',
  isSuperAdmin,
  [
    param('id').isMongoId().withMessage('Invalid redeem id'),
    body('note')
      .trim()
      .notEmpty()
      .withMessage('Rejection reason is required')
      .isLength({ max: 1000 })
      .withMessage('Rejection reason is too long'),
  ],
  validate,
  AffiliateEarningsController.reject
);

router.use(isAffiliate);
router.get('/summary', AffiliateEarningsController.getSummary);
router.get('/redeems', AffiliateEarningsController.listRedeems);
router.post('/redeem', AffiliateEarningsController.redeem);

module.exports = router;
