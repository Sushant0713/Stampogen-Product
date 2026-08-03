const { body, param } = require('express-validator');

const createPlanValidator = [
  body('name').trim().notEmpty().withMessage('Plan name is required'),
  body('code').trim().notEmpty().withMessage('Plan code is required'),
  body('billing')
    .optional()
    .isIn(['Monthly', 'Yearly', 'Custom'])
    .withMessage('Invalid billing cycle'),
  body('status').optional().isIn(['Active', 'Inactive']).withMessage('Invalid status'),
  body('featureIds').optional().isArray().withMessage('Features must be an array'),
  body('featureIds.*').optional().isMongoId().withMessage('Invalid feature ID'),
  body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
  body('priceAmount').optional().isFloat({ min: 0 }).withMessage('Price must be 0 or greater'),
  body('mrpAmount').optional().isFloat({ min: 0 }).withMessage('MRP must be 0 or greater'),
  body('users').optional().isInt({ min: 0 }).withMessage('Users limit must be 0 or greater'),
  body('usersUnlimited').optional().isBoolean().withMessage('usersUnlimited must be a boolean'),
  body('featuredOnWebsite')
    .optional()
    .isBoolean()
    .withMessage('featuredOnWebsite must be a boolean'),
  body('badgeText')
    .optional()
    .trim()
    .isLength({ max: 40 })
    .withMessage('Badge text must be at most 40 characters'),
  body('forOutlet').optional().isBoolean().withMessage('forOutlet must be a boolean'),
];

const updatePlanValidator = [
  param('id').isMongoId().withMessage('Invalid plan ID'),
  body('name').optional().trim().notEmpty().withMessage('Plan name is required'),
  body('code').optional().trim().notEmpty().withMessage('Plan code is required'),
  body('billing')
    .optional()
    .isIn(['Monthly', 'Yearly', 'Custom'])
    .withMessage('Invalid billing cycle'),
  body('status').optional().isIn(['Active', 'Inactive']).withMessage('Invalid status'),
  body('featureIds').optional().isArray().withMessage('Features must be an array'),
  body('featureIds.*').optional().isMongoId().withMessage('Invalid feature ID'),
  body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
  body('priceAmount').optional().isFloat({ min: 0 }).withMessage('Price must be 0 or greater'),
  body('mrpAmount').optional().isFloat({ min: 0 }).withMessage('MRP must be 0 or greater'),
  body('visibleWebsite').optional().isBoolean().withMessage('visibleWebsite must be a boolean'),
  body('visibleSuperAdmin')
    .optional()
    .isBoolean()
    .withMessage('visibleSuperAdmin must be a boolean'),
  body('users').optional().isInt({ min: 0 }).withMessage('Users limit must be 0 or greater'),
  body('usersUnlimited').optional().isBoolean().withMessage('usersUnlimited must be a boolean'),
  body('featuredOnWebsite')
    .optional()
    .isBoolean()
    .withMessage('featuredOnWebsite must be a boolean'),
  body('badgeText')
    .optional()
    .trim()
    .isLength({ max: 40 })
    .withMessage('Badge text must be at most 40 characters'),
  body('forOutlet').optional().isBoolean().withMessage('forOutlet must be a boolean'),
];

const planIdValidator = [param('id').isMongoId().withMessage('Invalid plan ID')];

const bulkDeletePlanValidator = [
  body('ids').isArray({ min: 1 }).withMessage('At least one plan id is required'),
  body('ids.*').isMongoId().withMessage('Invalid plan ID'),
];

module.exports = {
  createPlanValidator,
  updatePlanValidator,
  planIdValidator,
  bulkDeletePlanValidator,
};
