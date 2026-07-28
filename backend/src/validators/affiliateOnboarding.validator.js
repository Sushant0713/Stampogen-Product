const { query, body } = require('express-validator');

const getUploadMetaValidator = [
  query('token')
    .trim()
    .notEmpty()
    .withMessage('Upload token is required')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid upload token'),
];

const getCredentialsMetaValidator = [
  query('token')
    .trim()
    .notEmpty()
    .withMessage('Access token is required')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid access token'),
];

const uploadSignedAgreementValidator = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Upload token is required')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid upload token'),
  body('document')
    .trim()
    .notEmpty()
    .withMessage('Document is required')
    .isLength({ max: 12 * 1024 * 1024 })
    .withMessage('Document is too large'),
  body('documentName')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Document name is too long'),
];

module.exports = {
  getUploadMetaValidator,
  getCredentialsMetaValidator,
  uploadSignedAgreementValidator,
};
