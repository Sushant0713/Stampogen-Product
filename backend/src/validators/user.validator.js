const { body, param } = require('express-validator');
const { AFFILIATE_TYPE_VALUES } = require('@constants/affiliateTypes');

const createAffiliateValidator = [
  body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 50 }),
  body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 50 }),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email'),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('affiliateType')
    .trim()
    .notEmpty()
    .withMessage('Affiliate type is required')
    .isIn(AFFILIATE_TYPE_VALUES)
    .withMessage('Invalid affiliate type'),
  body('verificationDocument').trim().notEmpty().withMessage('Verification document is required'),
  body('verificationDocumentName').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('collegeName').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('universityName').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('socialMediaAccount').optional({ nullable: true }).trim().isLength({ max: 300 }),
  body('resumeDocument').optional({ nullable: true }).trim(),
  body('resumeDocumentName').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('joinReason')
    .trim()
    .notEmpty()
    .withMessage('Join reason is required')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Please provide a valid join reason'),
  body('verificationStatus')
    .optional()
    .isIn(['pending', 'verified', 'rejected'])
    .withMessage('Invalid verification status'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const scheduleInterviewValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('meetLink')
    .trim()
    .notEmpty()
    .withMessage('Google Meet link is required')
    .isLength({ max: 500 })
    .withMessage('Meet link is too long'),
  body('interviewAt')
    .notEmpty()
    .withMessage('Interview date and time are required')
    .custom((value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid interview date and time');
      }
      return true;
    }),
  body('note').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

const affiliateDecisionValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('note').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

const holdAffiliateValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('note').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

const rejectAffiliateValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('reason')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }),
  body('note')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }),
  body().custom((_, { req }) => {
    const reason = String(req.body.reason || req.body.note || '').trim();
    if (reason.length < 5) {
      throw new Error('Rejection reason is required (at least 5 characters)');
    }
    return true;
  }),
];

const updateUserValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('affiliateType')
    .optional()
    .trim()
    .isIn(AFFILIATE_TYPE_VALUES)
    .withMessage('Invalid affiliate type'),
  body('collegeName').optional().trim().isLength({ max: 200 }),
  body('universityName').optional().trim().isLength({ max: 200 }),
  body('socialMediaAccount').optional().trim().isLength({ max: 300 }),
  body('joinReason').optional().trim().isLength({ max: 1000 }),
  body('verificationStatus')
    .optional()
    .isIn(['pending', 'verified', 'rejected'])
    .withMessage('Invalid verification status'),
  body('affiliateDiscountPercent')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Partner discount must be 0–100'),
  body('affiliateEarningPercent')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('Earning percent must be 0–100'),
  body('affiliateMinimumTargetValue')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Minimum target must be 0 or greater'),
];

const userIdValidator = [param('id').isMongoId().withMessage('Invalid user ID')];

module.exports = {
  createAffiliateValidator,
  scheduleInterviewValidator,
  affiliateDecisionValidator,
  holdAffiliateValidator,
  rejectAffiliateValidator,
  updateUserValidator,
  userIdValidator,
};
