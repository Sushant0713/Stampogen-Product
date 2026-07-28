const AffiliateOnboardingService = require('@services/affiliateOnboarding.service');
const { sendSuccess } = require('@utils/response');

class AffiliateOnboardingController {
  async getUploadMeta(req, res, next) {
    try {
      const data = await AffiliateOnboardingService.getUploadMeta(req.query.token);
      return sendSuccess(res, {
        message: 'Upload link is valid',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async uploadSignedAgreement(req, res, next) {
    try {
      const data = await AffiliateOnboardingService.uploadSignedAgreement(req.body);
      return sendSuccess(res, {
        message: 'Signed agreement uploaded successfully',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getCredentialsMeta(req, res, next) {
    try {
      const data = await AffiliateOnboardingService.getCredentialsMeta(req.query.token);
      return sendSuccess(res, {
        message: 'Access link is valid',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AffiliateOnboardingController();
