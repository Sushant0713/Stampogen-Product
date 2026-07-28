const AgreementSettingsService = require('@services/agreementSettings.service');
const { sendSuccess } = require('@utils/response');

class AgreementSettingsController {
  async get(req, res, next) {
    try {
      const settings = await AgreementSettingsService.get(
        req.query.audience || req.query.key || 'affiliate'
      );
      return sendSuccess(res, {
        message: 'Terms and conditions retrieved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getPublic(req, res, next) {
    try {
      const settings = await AgreementSettingsService.get(
        req.query.audience || req.query.key || 'affiliate'
      );
      return sendSuccess(res, {
        message: 'Terms and conditions retrieved',
        data: {
          settings: {
            key: settings.key,
            title: settings.title,
            content: settings.content,
            version: settings.version,
            effectiveDate: settings.effectiveDate,
            requireAcceptance: settings.requireAcceptance,
            isActive: settings.isActive,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  async upsert(req, res, next) {
    try {
      const settings = await AgreementSettingsService.upsert(req.body);
      return sendSuccess(res, {
        message: 'Terms and conditions saved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AgreementSettingsController();
