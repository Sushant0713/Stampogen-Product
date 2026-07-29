const { body, param } = require('express-validator');

const platformInvoiceIdValidator = [
  param('id').isMongoId().withMessage('Invalid invoice ID'),
];

const bulkDeletePlatformInvoiceValidator = [
  body('ids').isArray({ min: 1 }).withMessage('At least one invoice id is required'),
  body('ids.*').isMongoId().withMessage('Invalid invoice ID'),
];

module.exports = {
  platformInvoiceIdValidator,
  bulkDeletePlatformInvoiceValidator,
};
