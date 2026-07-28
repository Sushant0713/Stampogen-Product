const express = require('express');
const UserController = require('@controllers/user.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isAdminOrSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const {
  createAffiliateValidator,
  scheduleInterviewValidator,
  affiliateDecisionValidator,
  holdAffiliateValidator,
  rejectAffiliateValidator,
  updateUserValidator,
  userIdValidator,
} = require('@validators/user.validator');

const router = express.Router();

router.use(authenticate);
router.use(isAdminOrSuperAdmin);

router.get('/', UserController.getAll);
router.get('/affiliate-stats', UserController.affiliateStats);
router.post(
  '/affiliates',
  createAffiliateValidator,
  validate,
  UserController.createAffiliate
);
router.post(
  '/affiliates/:id/schedule-interview',
  scheduleInterviewValidator,
  validate,
  UserController.scheduleAffiliateInterview
);
router.post(
  '/affiliates/:id/hold',
  holdAffiliateValidator,
  validate,
  UserController.holdAffiliate
);
router.post(
  '/affiliates/:id/resume',
  userIdValidator,
  validate,
  UserController.resumeAffiliate
);
router.post(
  '/affiliates/:id/request-signed-agreement',
  userIdValidator,
  validate,
  UserController.requestSignedAgreementOnboarding
);
router.post(
  '/affiliates/:id/approve',
  affiliateDecisionValidator,
  validate,
  UserController.approveAffiliate
);
router.post(
  '/affiliates/:id/resend-credentials',
  userIdValidator,
  validate,
  UserController.resendAffiliateCredentials
);
router.post(
  '/affiliates/:id/reject',
  rejectAffiliateValidator,
  validate,
  UserController.rejectAffiliate
);
router.get(
  '/affiliates/:id/clients',
  userIdValidator,
  validate,
  UserController.getAffiliateClients
);
router.get('/:id', userIdValidator, validate, UserController.getById);
router.patch('/:id', updateUserValidator, validate, UserController.update);
router.delete('/:id', userIdValidator, validate, UserController.delete);

module.exports = router;
