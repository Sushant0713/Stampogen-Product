const express = require('express');
const passport = require('passport');
const AuthController = require('@controllers/auth.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { authLimiter } = require('@middlewares/rateLimit.middleware');
const validate = require('@middlewares/validate.middleware');
const {
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
} = require('@validators/auth.validator');
const { AUTHENTICATED_ROLES } = require('@constants/roles');

const router = express.Router();

router.post(
  '/google/profile',
  authLimiter,
  googleProfileValidator,
  validate,
  AuthController.googleProfile
);

router.post(
  '/google/:role',
  authLimiter,
  googleRoleParamValidator,
  googleTokenValidator,
  validate,
  AuthController.googleToken
);

router.post(
  '/register/:role',
  authLimiter,
  roleParamValidator,
  registerValidator,
  validate,
  AuthController.register
);

router.post(
  '/verify-email/:role',
  authLimiter,
  roleParamValidator,
  verifyOtpValidator,
  validate,
  AuthController.verifyEmail
);

router.post(
  '/login-otp/:role',
  authLimiter,
  roleParamValidator,
  loginOtpRequestValidator,
  validate,
  AuthController.requestLoginOtp
);

router.post(
  '/verify-login-otp/:role',
  authLimiter,
  roleParamValidator,
  verifyOtpValidator,
  validate,
  AuthController.verifyLoginOtp
);

router.post(
  '/resend-otp/:role',
  authLimiter,
  roleParamValidator,
  resendOtpValidator,
  validate,
  AuthController.resendOtp
);

router.post(
  '/login/:role',
  authLimiter,
  roleParamValidator,
  loginValidator,
  validate,
  AuthController.login
);

router.post(
  '/forgot-password/:role',
  authLimiter,
  roleParamValidator,
  forgotPasswordValidator,
  validate,
  AuthController.forgotPassword
);

router.post(
  '/reset-password/:role',
  authLimiter,
  roleParamValidator,
  resetPasswordValidator,
  validate,
  AuthController.resetPassword
);

router.post('/refresh', AuthController.refresh);
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.me);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${require('@config').frontendUrl}/?error=Google%20auth%20failed`,
  }),
  AuthController.googleCallback
);

router.get('/google/:role', authLimiter, (req, res, next) => {
  const { role } = req.params;
  const config = require('@config');

  if (!AUTHENTICATED_ROLES.includes(role)) {
    return res.redirect(`${config.frontendUrl}/?error=Invalid%20role`);
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state: role,
  })(req, res, next);
});

module.exports = router;
