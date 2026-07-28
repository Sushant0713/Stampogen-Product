const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { AffiliateSettings } = require('@models');
const {
  DEFAULT_AFFILIATE_SETTINGS,
  toAffiliateSettingsView,
  toPublicAffiliateSettingsView,
  normalizeAffiliateSettingsPayload,
} = require('@helpers/affiliateSettings.helper');
const { AFFILIATE_TYPE_VALUES } = require('@constants/affiliateTypes');

class AffiliateSettingsService {
  async getDoc() {
    let settings = await AffiliateSettings.findOne({ key: 'platform' });
    if (!settings) {
      settings = await AffiliateSettings.create({
        key: 'platform',
        ...DEFAULT_AFFILIATE_SETTINGS,
      });
    }
    return settings;
  }

  async get() {
    const settings = await this.getDoc();
    return toAffiliateSettingsView(settings);
  }

  async getPublic() {
    const settings = await this.getDoc();
    return toPublicAffiliateSettingsView(settings);
  }

  async getForAffiliate(user) {
    const view = await this.get();
    const type = String(user?.affiliateType || '').trim();
    const typeConfig = view.types?.[type] || null;
    const typeDiscount = typeConfig?.defaultDiscountPercent ?? 20;
    const typeEarning = typeConfig?.earningPercent ?? typeDiscount;
    const typeTarget = typeConfig?.minimumTargetValue ?? 0;
    return {
      paymentCycle: view.paymentCycle,
      affiliateType: type || null,
      typeLabel: typeConfig?.label || type || null,
      enabled: typeConfig ? Boolean(typeConfig.enabled) : false,
      defaultDiscountPercent: typeDiscount,
      earningPercent:
        user?.affiliateEarningPercent != null ? Number(user.affiliateEarningPercent) : typeEarning,
      minimumTargetValue:
        user?.affiliateMinimumTargetValue != null
          ? Number(user.affiliateMinimumTargetValue)
          : typeTarget,
      discountCode: user?.affiliateDiscountCode || '',
      discountPercent:
        user?.affiliateDiscountPercent != null
          ? Number(user.affiliateDiscountPercent)
          : typeDiscount,
    };
  }

  async upsert(body) {
    const data = normalizeAffiliateSettingsPayload(body);
    const settings = await AffiliateSettings.findOneAndUpdate(
      { key: 'platform' },
      { $set: data },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    return toAffiliateSettingsView(settings);
  }

  /** Config for one affiliate type (enabled, discount %, earning %, target). */
  async getTypeConfig(affiliateType) {
    const type = String(affiliateType || '').trim();
    if (!AFFILIATE_TYPE_VALUES.includes(type)) {
      return null;
    }
    const view = await this.get();
    return view.types[type] || null;
  }

  async assertTypeEnabled(affiliateType) {
    const config = await this.getTypeConfig(affiliateType);
    if (!config) {
      throw new AppError('Invalid affiliate type', HTTP_STATUS.BAD_REQUEST);
    }
    if (!config.enabled) {
      throw new AppError(
        'This affiliate type is currently closed for new registrations',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    return config;
  }
}

module.exports = new AffiliateSettingsService();
