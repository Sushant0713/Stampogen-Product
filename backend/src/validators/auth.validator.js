const { body, param } = require('express-validator');
const { AUTHENTICATED_ROLES, GOOGLE_AUTH_ROLES } = require('@constants/roles');
const {
  AFFILIATE_TYPE_VALUES,
  getRequiredVerificationKind,
  getVerificationDocLabel,
  isValidVerificationDocument,
  buildAffiliateExtraFields,
} = require('@constants/affiliateTypes');

function assertAffiliateVerification(req) {
  const affiliateType = String(req.body.affiliateType || '').trim();
  if (!AFFILIATE_TYPE_VALUES.includes(affiliateType)) {
    throw new Error('Affiliate type is required');
  }

  const kind = getRequiredVerificationKind(affiliateType);
  const label = getVerificationDocLabel(kind);
  const document = String(req.body.verificationDocument || '').trim();
  if (!isValidVerificationDocument(document)) {
    throw new Error(`${label} is required (JPG, PNG, WEBP, or PDF, max 5MB)`);
  }

  const extras = buildAffiliateExtraFields(affiliateType, req.body);
  if (!extras.ok) {
    throw new Error(extras.error);
  }
}

const registerValidator = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name must be at most 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name must be at most 50 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .if((_value, { req }) => {
      const role = req.params.role || req.body.role;
      return role !== 'affiliate';
    })
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('role')
    .optional()
    .isIn(AUTHENTICATED_ROLES)
    .withMessage('Invalid role'),
  body('tenantName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tenant name must be between 2 and 100 characters'),
  body('loyaltyStampMode')
    .optional()
    .isIn(['bill', 'request'])
    .withMessage('Invalid loyalty stamp mode'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone must be at most 20 characters'),
  body('street').optional().trim().isLength({ max: 300 }),
  body('city').optional().trim().isLength({ max: 100 }),
  body('state').optional().trim().isLength({ max: 100 }),
  body('pin').optional().trim().isLength({ max: 10 }),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be at most 500 characters'),
  body('gstin')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('GSTIN must be at most 20 characters'),
  body('pan')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('PAN must be at most 20 characters'),
  body('affiliateType')
    .optional()
    .trim()
    .isIn(AFFILIATE_TYPE_VALUES)
    .withMessage('Invalid affiliate type'),
  body('verificationDocument').optional().isString(),
  body('verificationDocumentName').optional().trim().isLength({ max: 200 }),
  body('collegeName').optional().trim().isLength({ max: 200 }),
  body('universityName').optional().trim().isLength({ max: 200 }),
  body('socialMediaAccount').optional().trim().isLength({ max: 300 }),
  body('joinReason').optional().trim().isLength({ max: 1000 }),
  body('resumeDocument').optional().isString(),
  body('resumeDocumentName').optional().trim().isLength({ max: 200 }),
  body('acceptTerms').optional(),
  body().custom(async (_, { req }) => {
    const role = req.params.role || req.body.role;
    if (role === 'admin' || req.body.role === 'admin') {
      if (String(req.body.phone || '').trim().length < 8) {
        throw new Error('Phone number is required');
      }
      const street = String(req.body.street || '').trim();
      const address = String(req.body.address || '').trim();
      if (street.length < 3 && address.length < 5) {
        throw new Error('Street address is required');
      }
      if (String(req.body.state || '').trim().length < 2) {
        throw new Error('State is required');
      }
      if (String(req.body.city || '').trim().length < 2) {
        throw new Error('City is required');
      }
      if (!/^\d{6}$/.test(String(req.body.pin || '').trim())) {
        throw new Error('Valid 6-digit PIN code is required');
      }
    }
    if (req.params.role === 'affiliate' || req.body.role === 'affiliate') {
      assertAffiliateVerification(req);
    }
    if (role === 'admin' || role === 'affiliate') {
      await assertTermsAccepted(req, role);
    }
    return true;
  }),
];

async function assertTermsAccepted(req, role) {
  const AgreementSettingsService = require('@services/agreementSettings.service');
  const audience = role === 'admin' ? 'client' : 'affiliate';
  const settings = await AgreementSettingsService.get(audience);
  if (!settings?.isActive || !settings?.requireAcceptance) {
    return;
  }
  const accepted =
    req.body.acceptTerms === true ||
    req.body.acceptTerms === 'true' ||
    req.body.acceptTerms === 1 ||
    req.body.acceptTerms === '1';
  if (!accepted) {
    throw new Error('You must accept the Terms and Conditions to continue');
  }
}
const loginValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const loginOtpRequestValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
];

const verifyOtpValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must be numeric'),
];

const resendOtpValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('purpose')
    .optional()
    .isIn(['email_verification', 'login', 'password_reset'])
    .withMessage('Invalid OTP purpose'),
];

const forgotPasswordValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
];

const resetPasswordValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must be numeric'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
];

const roleParamValidator = [
  param('role').isIn(AUTHENTICATED_ROLES).withMessage('Invalid role'),
];

const googleRoleParamValidator = [
  param('role').isIn(GOOGLE_AUTH_ROLES).withMessage('Invalid role'),
];

const googleTokenValidator = [
  body('credential').optional().isString().withMessage('Google credential must be a string'),
  body('idToken').optional().isString().withMessage('Google idToken must be a string'),
  body('accessToken').optional().isString().withMessage('Google accessToken must be a string'),
  body('allowCreate')
    .optional({ values: 'falsy' })
    .isBoolean()
    .withMessage('allowCreate must be a boolean'),
  body('tenantName').optional().isString().trim().isLength({ max: 100 }),
  body('loyaltyStampMode').optional().isIn(['bill', 'request']),
  body('firstName').optional().isString().trim().isLength({ max: 50 }),
  body('lastName').optional().isString().trim().isLength({ max: 50 }),
  body('phone').optional().isString().trim().isLength({ max: 20 }),
  body('street').optional().isString().trim().isLength({ max: 300 }),
  body('city').optional().isString().trim().isLength({ max: 100 }),
  body('state').optional().isString().trim().isLength({ max: 100 }),
  body('pin').optional().isString().trim().isLength({ max: 10 }),
  body('address').optional().isString().trim().isLength({ max: 500 }),
  body('gstin').optional().isString().trim().isLength({ max: 20 }),
  body('pan').optional().isString().trim().isLength({ max: 20 }),
  body('affiliateType')
    .optional()
    .trim()
    .isIn(AFFILIATE_TYPE_VALUES)
    .withMessage('Invalid affiliate type'),
  body('verificationDocument').optional().isString(),
  body('verificationDocumentName').optional().trim().isLength({ max: 200 }),
  body('collegeName').optional().trim().isLength({ max: 200 }),
  body('universityName').optional().trim().isLength({ max: 200 }),
  body('socialMediaAccount').optional().trim().isLength({ max: 300 }),
  body('joinReason').optional().trim().isLength({ max: 1000 }),
  body('resumeDocument').optional().isString(),
  body('resumeDocumentName').optional().trim().isLength({ max: 200 }),
  body('acceptTerms').optional(),
  body().custom(async (_, { req }) => {
    if (!req.body.credential && !req.body.idToken && !req.body.accessToken) {
      throw new Error('Google credential is required');
    }
    if (
      req.body.allowCreate === true &&
      req.params.role === 'admin' &&
      String(req.body.tenantName || '').trim().length < 2
    ) {
      throw new Error('Organization name is required before signing up with Google');
    }
    if (req.body.allowCreate === true && req.params.role === 'admin') {
      if (String(req.body.phone || '').trim().length < 8) {
        throw new Error('Phone number is required');
      }
      const street = String(req.body.street || '').trim();
      const address = String(req.body.address || '').trim();
      if (street.length < 3 && address.length < 5) {
        throw new Error('Street address is required');
      }
      if (String(req.body.state || '').trim().length < 2) {
        throw new Error('State is required');
      }
      if (String(req.body.city || '').trim().length < 2) {
        throw new Error('City is required');
      }
      if (!/^\d{6}$/.test(String(req.body.pin || '').trim())) {
        throw new Error('Valid 6-digit PIN code is required');
      }
    }
    if (req.body.allowCreate === true && req.params.role === 'affiliate') {
      assertAffiliateVerification(req);
    }
    if (
      req.body.allowCreate === true &&
      (req.params.role === 'admin' || req.params.role === 'affiliate')
    ) {
      await assertTermsAccepted(req, req.params.role);
    }
    return true;
  }),
];

const googleProfileValidator = [
  body('credential').optional().isString().withMessage('Google credential must be a string'),
  body('idToken').optional().isString().withMessage('Google idToken must be a string'),
  body('accessToken').optional().isString().withMessage('Google accessToken must be a string'),
  body().custom((_, { req }) => {
    if (!req.body.credential && !req.body.idToken && !req.body.accessToken) {
      throw new Error('Google credential is required');
    }
    return true;
  }),
];

module.exports = {
  registerValidator,
  loginValidator,
  loginOtpRequestValidator,
  verifyOtpValidator,
  resendOtpValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  roleParamValidator,
  googleRoleParamValidator,
  googleTokenValidator,
  googleProfileValidator,
};
