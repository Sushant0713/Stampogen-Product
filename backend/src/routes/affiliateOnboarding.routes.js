const express = require('express');
const AffiliateOnboardingController = require('@controllers/affiliateOnboarding.controller');
const { authLimiter } = require('@middlewares/rateLimit.middleware');
const validate = require('@middlewares/validate.middleware');
const {
  getUploadMetaValidator,
  getCredentialsMetaValidator,
  uploadSignedAgreementValidator,
} = require('@validators/affiliateOnboarding.validator');

const router = express.Router();

router.get(
  '/upload-meta',
  authLimiter,
  getUploadMetaValidator,
  validate,
  AffiliateOnboardingController.getUploadMeta
);

router.get(
  '/credentials-meta',
  authLimiter,
  getCredentialsMetaValidator,
  validate,
  AffiliateOnboardingController.getCredentialsMeta
);

router.post(
  '/upload-signed-agreement',
  authLimiter,
  uploadSignedAgreementValidator,
  validate,
  AffiliateOnboardingController.uploadSignedAgreement
);

module.exports = router;
