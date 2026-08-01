const { body, param } = require('express-validator');

const createPlatformQrValidator = [
  body('title').trim().isLength({ min: 2, max: 120 }).withMessage('Title is required'),
  body('url').trim().isLength({ min: 3, max: 2000 }).withMessage('URL is required'),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
];

const updatePlatformQrValidator = [
  param('id').isMongoId().withMessage('Invalid QR id'),
  body('title').optional().trim().isLength({ min: 2, max: 120 }).withMessage('Title is required'),
  body('url').optional().trim().isLength({ min: 3, max: 2000 }).withMessage('URL is required'),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
];

const platformQrIdValidator = [param('id').isMongoId().withMessage('Invalid QR id')];

module.exports = {
  createPlatformQrValidator,
  updatePlatformQrValidator,
  platformQrIdValidator,
};
