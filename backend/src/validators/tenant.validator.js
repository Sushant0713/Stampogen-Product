const { body, param } = require('express-validator');
const { TENANT_STATUS } = require('@constants');

const createTenantValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Tenant name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tenant name must be between 2 and 100 characters'),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
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

const tenantIdValidator = [param('id').isMongoId().withMessage('Invalid tenant ID')];

module.exports = {
  createTenantValidator,
  updateTenantValidator,
  changePlanValidator,
  tenantIdValidator,
};
