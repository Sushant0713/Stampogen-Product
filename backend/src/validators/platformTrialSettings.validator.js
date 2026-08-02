const { body } = require('express-validator');

const upsertPlatformTrialSettingsValidator = [
  body('enabled').optional().isBoolean().withMessage('enabled must be a boolean'),
  body('applyOnPublicSignup')
    .optional()
    .isBoolean()
    .withMessage('applyOnPublicSignup must be a boolean'),
  body('trialDays')
    .optional()
    .isInt({ min: 1, max: 3650 })
    .withMessage('trialDays must be between 1 and 3650'),
  body('planId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid plan ID'),
  body('planCode').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
];

module.exports = {
  upsertPlatformTrialSettingsValidator,
};
