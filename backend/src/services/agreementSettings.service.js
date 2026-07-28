const { AgreementSettings } = require('@models');
const {
  getDefaultSettings,
  toAgreementSettingsView,
  normalizeAgreementSettingsPayload,
  normalizeAudience,
} = require('@helpers/agreementSettings.helper');

class AgreementSettingsService {
  async get(audienceInput) {
    const audience = normalizeAudience(audienceInput);
    let settings = await AgreementSettings.findOne({ key: audience });
    if (!settings) {
      const defaults = getDefaultSettings(audience);
      settings = await AgreementSettings.create({
        ...defaults,
        effectiveDate: new Date().toISOString().slice(0, 10),
      });
    }
    return toAgreementSettingsView(settings, audience);
  }

  async upsert(body = {}) {
    const audience = normalizeAudience(body.audience || body.key);
    const data = normalizeAgreementSettingsPayload(body, audience);
    const settings = await AgreementSettings.findOneAndUpdate(
      { key: audience },
      { $set: { ...data, key: audience } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    return toAgreementSettingsView(settings, audience);
  }
}

module.exports = new AgreementSettingsService();
