const express = require('express');
const LoyaltyController = require('@controllers/loyalty.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isCustomer, isAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const { body, param, query } = require('express-validator');

const router = express.Router();

router.get(
  '/shops/:slug/preview',
  param('slug').trim().notEmpty().withMessage('Shop slug is required'),
  validate,
  LoyaltyController.shopPreview
);

router.get(
  '/admin/rewards',
  authenticate,
  isAdmin,
  query('filter').optional().isIn(['pending', 'redeemed', 'all']),
  validate,
  LoyaltyController.adminListRewards
);

router.get(
  '/admin/customers',
  authenticate,
  isAdmin,
  LoyaltyController.adminListCustomers
);

router.get(
  '/admin/customers/:id',
  authenticate,
  isAdmin,
  param('id').trim().notEmpty().withMessage('Customer id is required'),
  validate,
  LoyaltyController.adminGetCustomer
);

router.patch(
  '/admin/customers/:id',
  authenticate,
  isAdmin,
  param('id').trim().notEmpty().withMessage('Customer id is required'),
  body('status').isIn(['active', 'suspended']).withMessage('Status must be active or suspended'),
  validate,
  LoyaltyController.adminUpdateCustomer
);

router.delete(
  '/admin/customers/:id',
  authenticate,
  isAdmin,
  param('id').trim().notEmpty().withMessage('Customer id is required'),
  validate,
  LoyaltyController.adminDeleteCustomer
);

router.get(
  '/admin/stats',
  authenticate,
  isAdmin,
  LoyaltyController.adminDashboardStats
);

router.get(
  '/admin/settings',
  authenticate,
  isAdmin,
  LoyaltyController.adminGetSettings
);

router.patch(
  '/admin/settings',
  authenticate,
  isAdmin,
  body('loyaltyStampMode').optional().isIn(['bill', 'request']).withMessage('Invalid loyalty stamp mode'),
  body('socialLinks').optional().isObject().withMessage('Social links must be an object'),
  validate,
  LoyaltyController.adminUpdateSettings
);

router.get(
  '/admin/stamp-requests',
  authenticate,
  isAdmin,
  LoyaltyController.adminListStampRequests
);

router.get(
  '/admin/recent-bill-stamps',
  authenticate,
  isAdmin,
  LoyaltyController.adminListRecentBillStamps
);

router.post(
  '/admin/stamp-requests/:id/approve',
  authenticate,
  isAdmin,
  param('id').trim().notEmpty().withMessage('Invalid stamp request id'),
  validate,
  LoyaltyController.adminApproveStampRequest
);

router.post(
  '/admin/stamp-requests/:id/reject',
  authenticate,
  isAdmin,
  param('id').trim().notEmpty().withMessage('Invalid stamp request id'),
  validate,
  LoyaltyController.adminRejectStampRequest
);

router.get(
  '/admin/offers',
  authenticate,
  isAdmin,
  LoyaltyController.adminListOffers
);

router.post(
  '/admin/offers',
  authenticate,
  isAdmin,
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
  validate,
  LoyaltyController.adminCreateOffer
);

router.patch(
  '/admin/offers/:key',
  authenticate,
  isAdmin,
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
  validate,
  LoyaltyController.adminUpdateOffer
);

router.get(
  '/admin/rewards/:id',
  authenticate,
  isAdmin,
  param('id').trim().notEmpty().withMessage('Invalid reward id'),
  validate,
  LoyaltyController.adminGetReward
);

router.post(
  '/admin/rewards/:id/verify',
  authenticate,
  isAdmin,
  param('id').trim().notEmpty().withMessage('Invalid reward id'),
  validate,
  LoyaltyController.adminVerify
);

router.post(
  '/admin/rewards/:id/cancel',
  authenticate,
  isAdmin,
  param('id').trim().notEmpty().withMessage('Invalid reward id'),
  validate,
  LoyaltyController.adminCancel
);

router.post(
  '/admin/rewards/:id/give',
  authenticate,
  isAdmin,
  param('id').trim().notEmpty().withMessage('Invalid reward id'),
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
