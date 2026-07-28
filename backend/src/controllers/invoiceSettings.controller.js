const InvoiceSettingsService = require('@services/invoiceSettings.service');
const { sendSuccess } = require('@utils/response');

class InvoiceSettingsController {
  async get(req, res, next) {
    try {
      const settings = await InvoiceSettingsService.get();
      return sendSuccess(res, {
        message: 'Invoice settings retrieved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }

  async upsert(req, res, next) {
    try {
      const settings = await InvoiceSettingsService.upsert(req.body);
      return sendSuccess(res, {
        message: 'Invoice settings saved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new InvoiceSettingsController();
