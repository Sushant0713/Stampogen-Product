const AffiliateSettingsService = require('@services/affiliateSettings.service');
const { sendSuccess } = require('@utils/response');

class AffiliateSettingsController {
  async getPublic(req, res, next) {
    try {
      const settings = await AffiliateSettingsService.getPublic();
      return sendSuccess(res, {
        message: 'Affiliate settings retrieved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }

  async get(req, res, next) {
    try {
      const settings = await AffiliateSettingsService.get();
      return sendSuccess(res, {
        message: 'Affiliate settings retrieved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getMine(req, res, next) {
    try {
      const settings = await AffiliateSettingsService.getForAffiliate(req.user);
      return sendSuccess(res, {
        message: 'Affiliate program settings retrieved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }

  async upsert(req, res, next) {
    try {
      const settings = await AffiliateSettingsService.upsert(req.body);
      return sendSuccess(res, {
        message: 'Affiliate settings saved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AffiliateSettingsController();
