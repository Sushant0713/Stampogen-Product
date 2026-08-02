const PlatformTrialSettingsService = require('@services/platformTrialSettings.service');
const { sendSuccess } = require('@utils/response');

class PlatformTrialSettingsController {
  async getPublic(req, res, next) {
    try {
      const settings = await PlatformTrialSettingsService.getPublic();
      return sendSuccess(res, {
        message: 'Public trial settings',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }

  async get(req, res, next) {
    try {
      const settings = await PlatformTrialSettingsService.getOrCreate();
      return sendSuccess(res, {
        message: 'Platform trial settings',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }

  async upsert(req, res, next) {
    try {
      const settings = await PlatformTrialSettingsService.upsert(req.body);
      return sendSuccess(res, {
        message: 'Platform trial settings saved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new PlatformTrialSettingsController();
