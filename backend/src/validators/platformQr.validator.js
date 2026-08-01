const { body, param, query } = require('express-validator');

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

const platformQrCodeValidator = [
  param('code')
    .trim()
    .isLength({ min: 4, max: 32 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid QR code'),
];

const dateQuery = (field) =>
  query(field)
    .optional({ values: 'falsy' })
    .matches(/^\d{4}-\d{2}-\d{2}(T.*)?$/)
    .withMessage(`Invalid ${field} date`);

const platformQrReportsValidator = [
  dateQuery('from'),
  dateQuery('to'),
  dateQuery('dateFrom'),
  dateQuery('dateTo'),
  query('qrId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid QR id'),
  query('search').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  query('sort')
    .optional({ values: 'falsy' })
    .isIn(['scans', 'least', 'title', 'recent', 'newest'])
    .withMessage('Invalid sort'),
  query('minScans').optional({ values: 'falsy' }).isInt({ min: 0, max: 1000000 }),
];

module.exports = {
  createPlatformQrValidator,
  updatePlatformQrValidator,
  platformQrIdValidator,
  platformQrCodeValidator,
  platformQrReportsValidator,
};
