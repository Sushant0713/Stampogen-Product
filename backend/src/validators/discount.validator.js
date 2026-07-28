const { body, param } = require('express-validator');

const amountTypeValues = ['Percentage (%)', 'Flat (INR)', 'percentage', 'flat'];
const billingCycleValues = ['All billing cycles', 'Monthly', 'Yearly', 'Custom'];

const createDiscountValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Discount name is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('Discount name must be between 2 and 120 characters'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Promo code is required')
    .isLength({ min: 2, max: 40 })
    .withMessage('Promo code must be between 2 and 40 characters'),
  body('description').optional().isString().isLength({ max: 500 }),
  body('amountValue')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a valid number'),
  body('type')
    .optional()
    .isIn(['Simple discount', 'Partner discount', 'One Time Discount'])
    .withMessage('Invalid discount type'),
  body('amountType')
    .optional()
    .isIn(amountTypeValues)
    .withMessage('Invalid amount type'),
  body('specificPlan').optional().isString().isLength({ max: 120 }),
  body('billingCycle')
    .optional()
    .isIn(billingCycleValues)
    .withMessage('Invalid billing cycle'),
  body('minOrderAmount')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Minimum order amount must be 0 or greater'),
  body('maxUses')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Max uses must be 0 or greater'),
  body('startDate')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid start date'),
  body('endDate')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid end date'),
  body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
];

const updateDiscountValidator = [
  param('id').isMongoId().withMessage('Invalid discount ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Discount name must be between 2 and 120 characters'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 40 })
    .withMessage('Promo code must be between 2 and 40 characters'),
  body('description').optional().isString().isLength({ max: 500 }),
  body('amountValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Amount must be a valid number'),
  body('type')
    .optional()
    .isIn(['Simple discount', 'Partner discount', 'One Time Discount'])
    .withMessage('Invalid discount type'),
  body('amountType')
    .optional()
    .isIn(amountTypeValues)
    .withMessage('Invalid amount type'),
  body('specificPlan').optional().isString().isLength({ max: 120 }),
  body('billingCycle')
    .optional()
    .isIn(billingCycleValues)
    .withMessage('Invalid billing cycle'),
  body('minOrderAmount')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('Minimum order amount must be 0 or greater'),
  body('maxUses')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Max uses must be 0 or greater'),
  body('startDate')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid start date'),
  body('endDate')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid end date'),
  body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
];

const discountIdValidator = [param('id').isMongoId().withMessage('Invalid discount ID')];

const bulkDeleteValidator = [
  body('ids')
    .isArray({ min: 1 })
    .withMessage('At least one discount id is required'),
  body('ids.*').isMongoId().withMessage('Invalid discount ID'),
];

module.exports = {
  createDiscountValidator,
  updateDiscountValidator,
  discountIdValidator,
  bulkDeleteValidator,
};
