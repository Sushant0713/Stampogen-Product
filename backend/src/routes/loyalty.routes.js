const express = require('express');
const LoyaltyController = require('@controllers/loyalty.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isCustomer, isAdmin } = require('@middlewares/authorize.middleware');
const {
  requireActiveSubscription,
} = require('@middlewares/requireActiveSubscription.middleware');
const validate = require('@middlewares/validate.middleware');
const { body, param, query } = require('express-validator');

const router = express.Router();

/** Admin shop facilities — blocked after trial/plan end. */
const adminFacility = [authenticate, isAdmin, requireActiveSubscription];

router.get(
  '/shops/:slug/preview',
  param('slug').trim().notEmpty().withMessage('Shop slug is required'),
  validate,
  LoyaltyController.shopPreview
);

/** Optional HQ → child outlet scope (MongoId). */
const outletTenantQuery = query('outletTenantId')
  .optional({ values: 'falsy' })
  .isMongoId()
  .withMessage('Invalid outlet id');

const outletTenantBody = body('outletTenantId')
  .optional({ values: 'falsy' })
  .isMongoId()
  .withMessage('Invalid outlet id');

router.get(
  '/admin/rewards',
  ...adminFacility,
  query('filter').optional().isIn(['pending', 'redeemed', 'all']),
  outletTenantQuery,
  validate,
  LoyaltyController.adminListRewards
);

router.get(
  '/admin/customers',
  ...adminFacility,
  outletTenantQuery,
  validate,
  LoyaltyController.adminListCustomers
);

router.get(
  '/admin/customers/:id',
  ...adminFacility,
  param('id').trim().notEmpty().withMessage('Customer id is required'),
  outletTenantQuery,
  validate,
  LoyaltyController.adminGetCustomer
);

router.patch(
  '/admin/customers/:id',
  ...adminFacility,
  param('id').trim().notEmpty().withMessage('Customer id is required'),
  body('status').isIn(['active', 'suspended']).withMessage('Status must be active or suspended'),
  outletTenantBody,
  validate,
  LoyaltyController.adminUpdateCustomer
);

router.delete(
  '/admin/customers/:id',
  ...adminFacility,
  param('id').trim().notEmpty().withMessage('Customer id is required'),
  outletTenantQuery,
  validate,
  LoyaltyController.adminDeleteCustomer
);

router.get(
  '/admin/stats',
  ...adminFacility,
  outletTenantQuery,
  validate,
  LoyaltyController.adminDashboardStats
);

router.get('/admin/settings', ...adminFacility, LoyaltyController.adminGetSettings);

router.patch(
  '/admin/settings',
  ...adminFacility,
  body('loyaltyStampMode').optional().isIn(['bill', 'request']).withMessage('Invalid loyalty stamp mode'),
  body('socialLinks').optional().isObject().withMessage('Social links must be an object'),
  body('billingProfile').optional().isObject().withMessage('Billing profile must be an object'),
  validate,
  LoyaltyController.adminUpdateSettings
);

router.get(
  '/admin/stamp-requests',
  ...adminFacility,
  outletTenantQuery,
  validate,
  LoyaltyController.adminListStampRequests
);

router.get(
  '/admin/recent-bill-stamps',
  ...adminFacility,
  LoyaltyController.adminListRecentBillStamps
);

router.post(
  '/admin/stamp-requests/:id/approve',
  ...adminFacility,
  param('id').trim().notEmpty().withMessage('Invalid stamp request id'),
  outletTenantBody,
  validate,
  LoyaltyController.adminApproveStampRequest
);

router.post(
  '/admin/stamp-requests/:id/reject',
  ...adminFacility,
  param('id').trim().notEmpty().withMessage('Invalid stamp request id'),
  outletTenantBody,
  validate,
  LoyaltyController.adminRejectStampRequest
);

router.get('/admin/offers', ...adminFacility, LoyaltyController.adminListOffers);

router.post(
  '/admin/offers',
  ...adminFacility,
  body('title').trim().notEmpty().withMessage('Offer title is required').isLength({ max: 200 }),
  body('stampsRequired').optional().isInt({ min: 1, max: 100 }),
  body('color').optional().trim().isLength({ max: 40 }),
  body('startDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .toDate(),
  body('validUntil')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .toDate(),
  body('minOrderValue').optional().isFloat({ min: 0 }),
  body('maxCustomers').optional({ nullable: true, checkFalsy: true }),
  body('outletScope').optional().isIn(['all', 'selected']),
  body('outletTenantIds').optional().isArray(),
  body('outletTenantIds.*').optional().isMongoId(),
  validate,
  LoyaltyController.adminCreateOffer
);

router.patch(
  '/admin/offers/:key',
  ...adminFacility,
  param('key').trim().notEmpty().withMessage('Offer key is required'),
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('stampsRequired').optional().isInt({ min: 1, max: 100 }),
  body('status').optional().isIn(['active', 'paused']),
  body('color').optional().trim().isLength({ max: 40 }),
  body('startDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .toDate(),
  body('validUntil')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .toDate(),
  body('minOrderValue').optional().isFloat({ min: 0 }),
  body('maxCustomers').optional({ nullable: true, checkFalsy: true }),
  body('outletScope').optional().isIn(['all', 'selected']),
  body('outletTenantIds').optional().isArray(),
  body('outletTenantIds.*').optional().isMongoId(),
  validate,
  LoyaltyController.adminUpdateOffer
);

router.get(
  '/admin/rewards/:id',
  ...adminFacility,
  param('id').trim().notEmpty().withMessage('Invalid reward id'),
  outletTenantQuery,
  validate,
  LoyaltyController.adminGetReward
);

router.post(
  '/admin/rewards/:id/verify',
  ...adminFacility,
  param('id').trim().notEmpty().withMessage('Invalid reward id'),
  outletTenantBody,
  validate,
  LoyaltyController.adminVerify
);

router.post(
  '/admin/rewards/:id/cancel',
  ...adminFacility,
  param('id').trim().notEmpty().withMessage('Invalid reward id'),
  outletTenantBody,
  validate,
  LoyaltyController.adminCancel
);

router.post(
  '/admin/rewards/:id/give',
  ...adminFacility,
  param('id').trim().notEmpty().withMessage('Invalid reward id'),
  outletTenantBody,
  validate,
  LoyaltyController.adminGive
);

router.post(
  '/join',
  authenticate,
  isCustomer,
  body('tenantSlug').trim().notEmpty().withMessage('Shop slug is required'),
  validate,
  LoyaltyController.join
);

router.get('/cards', authenticate, isCustomer, LoyaltyController.listCards);

router.get(
  '/cards/:slug',
  authenticate,
  isCustomer,
  param('slug').trim().notEmpty().withMessage('Shop slug is required'),
  validate,
  LoyaltyController.getCard
);

router.get('/rewards', authenticate, isCustomer, LoyaltyController.listRewards);

router.get('/history', authenticate, isCustomer, LoyaltyController.listHistory);

router.post(
  '/cards/:slug/stamps',
  authenticate,
  isCustomer,
  param('slug').trim().notEmpty().withMessage('Shop slug is required'),
  body('offerKey').optional().trim().isLength({ max: 80 }),
  body('offerTitle').optional().trim().isLength({ max: 200 }),
  body('billDocument').notEmpty().withMessage('Bill photo is required'),
  body('billDocumentName').optional().trim().isLength({ max: 200 }),
  validate,
  LoyaltyController.addStamp
);

router.post(
  '/cards/:slug/stamp-requests',
  authenticate,
  isCustomer,
  param('slug').trim().notEmpty().withMessage('Shop slug is required'),
  body('offerKey').optional().trim().isLength({ max: 80 }),
  body('offerTitle').optional().trim().isLength({ max: 200 }),
  validate,
  LoyaltyController.requestStamp
);

router.post(
  '/cards/:slug/redeem',
  authenticate,
  isCustomer,
  param('slug').trim().notEmpty().withMessage('Shop slug is required'),
  body('offerKey').optional().trim().isLength({ max: 80 }),
  validate,
  LoyaltyController.redeem
);

module.exports = router;
