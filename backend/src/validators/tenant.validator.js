const { body, param, query } = require('express-validator');
const { TENANT_STATUS, SHOP_CATEGORY_VALUES } = require('@constants');

const createTenantValidator = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 80 })
    .withMessage('First name is too long'),
  body('middleName').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 80 })
    .withMessage('Last name is too long'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ min: 8, max: 20 })
    .withMessage('Invalid phone number'),
  body('password')
    .optional({ values: 'falsy' })
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be at least 8 characters'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Company / shop name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('slug')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Shop category is required')
    .isIn(SHOP_CATEGORY_VALUES)
    .withMessage('Invalid shop category'),
  body('customCategory').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('street').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  body('city').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('state').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
  body('pin').optional({ values: 'falsy' }).trim().matches(/^\d{6}$/).withMessage('PIN must be 6 digits'),
  body('address').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  body('gstin').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('pan').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('chargeGst')
    .optional()
    .isBoolean()
    .withMessage('chargeGst must be a boolean')
    .toBoolean(),
  body('planId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid plan ID'),
  body('planCode').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('planName').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('discountCode').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
];

const updateTenantValidator = [
  param('id').isMongoId().withMessage('Invalid tenant ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tenant name must be between 2 and 100 characters'),
  body('status')
    .optional()
    .isIn(Object.values(TENANT_STATUS))
    .withMessage('Invalid tenant status'),
];

const changePlanValidator = [
  param('id').isMongoId().withMessage('Invalid tenant ID'),
  body('planName').optional().trim().isLength({ min: 1, max: 120 }),
  body('planId').optional().isMongoId().withMessage('Invalid plan ID'),
  body('planCode').optional().isString().trim().isLength({ max: 80 }),
  body().custom((_, { req }) => {
    if (!req.body.planName && !req.body.planId && !req.body.planCode) {
      throw new Error('Plan is required');
    }
    return true;
  }),
];

const grantTrialValidator = [
  param('id').isMongoId().withMessage('Invalid tenant ID'),
  body('days').isInt({ min: 1, max: 3650 }).withMessage('Days must be between 1 and 3650'),
  body('planName').optional().trim().isLength({ min: 1, max: 120 }),
  body('planId').optional().isMongoId().withMessage('Invalid plan ID'),
  body('planCode').optional().isString().trim().isLength({ max: 80 }),
  body().custom((_, { req }) => {
    if (!req.body.planName && !req.body.planId && !req.body.planCode) {
      throw new Error('Plan is required');
    }
    return true;
  }),
];

const extendTrialValidator = [
  param('id').isMongoId().withMessage('Invalid tenant ID'),
  body('days').isInt({ min: 1, max: 3650 }).withMessage('Days must be between 1 and 3650'),
];

const trialReportsValidator = [
  query('from')
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid from date'),
  query('to')
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid to date'),
  query('status')
    .optional({ values: 'falsy' })
    .isIn(['all', 'active', 'expired', 'converted', 'expiring_soon']),
  query('origin').optional({ values: 'falsy' }).isIn(['all', 'signup', 'admin']),
  query('plan').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  query('search').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  query('sort')
    .optional({ values: 'falsy' })
    .isIn(['ending', 'newest', 'oldest', 'name', 'converted']),
];

const tenantIdValidator = [param('id').isMongoId().withMessage('Invalid tenant ID')];

module.exports = {
  createTenantValidator,
  updateTenantValidator,
  changePlanValidator,
  grantTrialValidator,
  extendTrialValidator,
  trialReportsValidator,
  tenantIdValidator,
};
