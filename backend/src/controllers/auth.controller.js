const AuthService = require('@services/auth.service');
const { sendSuccess } = require('@utils/response');
const { HTTP_STATUS, COOKIE_NAMES } = require('@constants');
const { setAuthCookies, clearAuthCookies } = require('@helpers/cookie.helper');
const config = require('@config');

class AuthController {
  async register(req, res, next) {
    try {
      const role = req.params.role || req.body.role;
      const result = await AuthService.register({ ...req.body, role });

      if (result.requiresVerification) {
        return sendSuccess(res, {
          statusCode: HTTP_STATUS.CREATED,
          message: result.message,
          data: {
            requiresVerification: true,
            email: result.email,
            expiresInMinutes: result.expiresInMinutes,
            preview: result.preview,
          },
        });
      }

      setAuthCookies(res, result.accessToken, result.refreshToken);

      return sendSuccess(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'Registration successful',
        data: { user: result.user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const role = req.params.role || req.body.role;
      const result = await AuthService.verifyEmailOtp({
        email: req.body.email,
        code: req.body.code,
        role,
      });

      if (result.requiresApproval) {
        return sendSuccess(res, {
          message: result.message,
          data: {
            requiresApproval: true,
            email: result.email,
            user: result.user,
          },
        });
      }

      setAuthCookies(res, result.accessToken, result.refreshToken);

      return sendSuccess(res, {
        message: 'Email verified successfully',
        data: { user: result.user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async requestLoginOtp(req, res, next) {
    try {
      const expectedRole = req.params.role || req.body.role;
      const result = await AuthService.requestLoginOtp({
        email: req.body.email,
        expectedRole,
      });

      return sendSuccess(res, {
        message: result.message,
        data: {
          requiresOtp: true,
          email: result.email,
          expiresInMinutes: result.expiresInMinutes,
          preview: result.preview,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  async verifyLoginOtp(req, res, next) {
    try {
      const role = req.params.role || req.body.role;
      const result = await AuthService.verifyLoginOtp({
        email: req.body.email,
        code: req.body.code,
        role,
      });

      setAuthCookies(res, result.accessToken, result.refreshToken);

      return sendSuccess(res, {
        message: 'Login successful',
        data: { user: result.user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async resendOtp(req, res, next) {
    try {
      const role = req.params.role || req.body.role;
      const result = await AuthService.resendOtp({
        email: req.body.email,
        purpose: req.body.purpose || 'email_verification',
        role,
      });

      return sendSuccess(res, {
        message: result.message,
        data: {
          email: result.email,
          expiresInMinutes: result.expiresInMinutes,
          preview: result.preview,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  async login(req, res, next) {
    try {
      const expectedRole = req.params.role || req.body.role;
      const result = await AuthService.login({
        email: req.body.email,
        password: req.body.password,
        expectedRole,
      });

      setAuthCookies(res, result.accessToken, result.refreshToken);

      return sendSuccess(res, {
        message: 'Login successful',
        data: { user: result.user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] || req.body.refreshToken;
      const result = await AuthService.refresh(refreshToken);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      return sendSuccess(res, {
        message: 'Token refreshed',
        data: { user: result.user },
      });
    } catch (error) {
      clearAuthCookies(res);
      return next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
      await AuthService.logout(refreshToken, req.user?._id);
      clearAuthCookies(res);

      return sendSuccess(res, {
        message: 'Logout successful',
      });
    } catch (error) {
      return next(error);
    }
  }

  async me(req, res, next) {
    try {
      const user = await AuthService.getMe(req.user._id);
      return sendSuccess(res, {
        message: 'Profile retrieved',
        data: { user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async googleCallback(req, res, next) {
    try {
      const result = await AuthService.handleGoogleAuth(req.user);

      if (result.requiresApproval) {
        const role = result.user?.role?.slug || req.query.state || 'affiliate';
        const loginPath = role === 'admin' ? '/' : `/${role}/login`;
        return res.redirect(
          `${config.frontendUrl}${loginPath}?error=${encodeURIComponent(result.message)}`
        );
      }

      setAuthCookies(res, result.accessToken, result.refreshToken);

      const role = result.user.role.slug;
      const redirectUrl =
        role === 'user'
          ? `${config.frontendUrl}/app`
          : `${config.frontendUrl}/${role}/dashboard`;

      return res.redirect(redirectUrl);
    } catch (error) {
      const role = req.query.state || 'admin';
      const loginPath = role === 'admin' ? '/' : `/${role}/login`;
      return res.redirect(
        `${config.frontendUrl}${loginPath}?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  async googleToken(req, res, next) {
    try {
      const role = req.params.role || req.body.role;
      const result = await AuthService.loginWithGoogle({
        idToken: req.body.credential || req.body.idToken,
        accessToken: req.body.accessToken,
        role,
        allowCreate: Boolean(req.body.allowCreate),
        tenantName: req.body.tenantName,
        loyaltyStampMode: req.body.loyaltyStampMode,
        category: req.body.category,
        customCategory: req.body.customCategory,
        firstName: req.body.firstName,
        middleName: req.body.middleName,
        lastName: req.body.lastName,
        birthDate: req.body.birthDate,
        phone: req.body.phone,
        address: req.body.address,
        street: req.body.street,
        city: req.body.city,
        state: req.body.state,
        pin: req.body.pin,
        gstin: req.body.gstin,
        pan: req.body.pan,
        affiliateType: req.body.affiliateType,
        verificationDocument: req.body.verificationDocument,
        verificationDocumentName: req.body.verificationDocumentName,
        collegeName: req.body.collegeName,
        universityName: req.body.universityName,
        socialMediaAccount: req.body.socialMediaAccount,
        resumeDocument: req.body.resumeDocument,
        resumeDocumentName: req.body.resumeDocumentName,
        joinReason: req.body.joinReason,
      });

      if (result.requiresApproval) {
        return sendSuccess(res, {
          message: result.message,
          data: {
            requiresApproval: true,
            email: result.email,
            user: result.user,
          },
        });
      }

      setAuthCookies(res, result.accessToken, result.refreshToken);

      return sendSuccess(res, {
        message: 'Google authentication successful',
        data: { user: result.user },
      });
    } catch (error) {
      return next(error);
    }
  }

  async googleProfile(req, res, next) {
    try {
      const profile = await AuthService.getGoogleProfilePreview({
        idToken: req.body.credential || req.body.idToken,
        accessToken: req.body.accessToken,
      });

      return sendSuccess(res, {
        message: 'Google profile loaded',
        data: { profile },
      });
    } catch (error) {
      return next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const expectedRole = req.params.role || req.body.role;
      const result = await AuthService.forgotPassword({
        email: req.body.email,
        expectedRole,
      });

      return sendSuccess(res, {
        message: result.message,
        data: {
          email: result.email,
          expiresInMinutes: result.expiresInMinutes,
          preview: result.preview,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const expectedRole = req.params.role || req.body.role;
      const result = await AuthService.resetPassword({
        email: req.body.email,
        code: req.body.code,
        password: req.body.password,
        expectedRole,
      });

      return sendSuccess(res, {
        message: result.message,
        data: { email: result.email },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AuthController();
