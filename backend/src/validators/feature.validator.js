const { body, param } = require('express-validator');

const createFeatureValidator = [
  body('name').trim().notEmpty().withMessage('Feature name is required'),
  body('code').trim().notEmpty().withMessage('Feature code is required'),
  body('category')
    .optional()
    .isIn(['Core', 'Brand', 'Analytics', 'Integrations', 'Support'])
    .withMessage('Invalid category'),
  body('status').optional().isIn(['Enabled', 'Disabled']).withMessage('Invalid status'),
  body('timesUsed').optional().isInt({ min: 0 }).withMessage('Times used must be a number'),
];

const updateFeatureValidator = [
  param('id').isMongoId().withMessage('Invalid feature ID'),
  body('name').optional().trim().notEmpty().withMessage('Feature name is required'),
  body('code').optional().trim().notEmpty().withMessage('Feature code is required'),
  body('category')
    .optional()
    .isIn(['Core', 'Brand', 'Analytics', 'Integrations', 'Support'])
    .withMessage('Invalid category'),
  body('status').optional().isIn(['Enabled', 'Disabled']).withMessage('Invalid status'),
  body('timesUsed').optional().isInt({ min: 0 }).withMessage('Times used must be a number'),
];

const featureIdValidator = [param('id').isMongoId().withMessage('Invalid feature ID')];

const bulkDeleteFeatureValidator = [
  body('ids').isArray({ min: 1 }).withMessage('At least one feature id is required'),
  body('ids.*').isMongoId().withMessage('Invalid feature ID'),
];

module.exports = {
  createFeatureValidator,
  updateFeatureValidator,
  featureIdValidator,
  bulkDeleteFeatureValidator,
};
