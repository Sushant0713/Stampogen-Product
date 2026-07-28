const { InvoiceSettings } = require('@models');
const {
  DEFAULT_INVOICE_SETTINGS,
  toInvoiceSettingsView,
  normalizeInvoiceSettingsPayload,
} = require('@helpers/invoiceSettings.helper');

class InvoiceSettingsService {
  async get() {
    let settings = await InvoiceSettings.findOne({ key: 'platform' });
    if (!settings) {
      settings = await InvoiceSettings.create({
        key: 'platform',
        ...DEFAULT_INVOICE_SETTINGS,
        defaults: {
          ...DEFAULT_INVOICE_SETTINGS.defaults,
          sampleInvoiceDate: new Date().toISOString().slice(0, 10),
        },
      });
    }
    return toInvoiceSettingsView(settings);
  }

  async upsert(body) {
    const data = normalizeInvoiceSettingsPayload(body);
    const settings = await InvoiceSettings.findOneAndUpdate(
      { key: 'platform' },
      { $set: data },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    return toInvoiceSettingsView(settings);
  }
}

module.exports = new InvoiceSettingsService();
