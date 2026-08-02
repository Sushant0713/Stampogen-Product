const { PlatformTrialSettings, Plan } = require('@models');
const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');

function toView(doc, plan = null) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    enabled: Boolean(plain.enabled),
    planId: plain.planId ? String(plain.planId) : null,
    planCode: plain.planCode || '',
    trialDays: Math.max(1, Number(plain.trialDays) || 14),
    applyOnPublicSignup: Boolean(plain.applyOnPublicSignup),
    plan: plan
      ? {
          id: String(plan._id || plan.id),
          name: plan.name,
          code: plan.code,
          priceAmount: Number(plan.priceAmount) || 0,
          billing: plan.billing || 'Monthly',
          status: plan.status,
          enabled: plan.enabled !== false,
        }
      : null,
    updatedAt: plain.updatedAt || null,
  };
}

async function resolvePlanFromSettings(settings) {
  if (!settings) return null;
  if (settings.planId) {
    const byId = await Plan.findById(settings.planId);
    if (byId) return byId;
  }
  const code = String(settings.planCode || '')
    .trim()
    .toLowerCase();
  if (code) {
    return Plan.findOne({ code });
  }
  return null;
}

class PlatformTrialSettingsService {
  async getOrCreate() {
    let settings = await PlatformTrialSettings.findOne({ key: 'platform' });
    if (!settings) {
      settings = await PlatformTrialSettings.create({ key: 'platform' });
    }
    const plan = await resolvePlanFromSettings(settings);
    return toView(settings, plan);
  }

  async getPublic() {
    const settings = await PlatformTrialSettings.findOne({ key: 'platform' });
    if (!settings) {
      return { available: false, trialDays: 14, plan: null };
    }
    const plan = await resolvePlanFromSettings(settings);
    const eligible =
      Boolean(settings.enabled) &&
      Boolean(settings.applyOnPublicSignup) &&
      plan &&
      plan.status === 'Active' &&
      plan.enabled !== false &&
      !plan.priceCustom;

    if (!eligible) {
      return {
        available: false,
        trialDays: Math.max(1, Number(settings.trialDays) || 14),
        plan: null,
      };
    }

    return {
      available: true,
      trialDays: Math.max(1, Number(settings.trialDays) || 14),
      plan: {
        id: String(plan._id),
        name: plan.name,
        code: plan.code,
        billing: plan.billing || 'Monthly',
      },
    };
  }

  async upsert(body = {}) {
    const enabled = Boolean(body.enabled);
    const applyOnPublicSignup = Boolean(body.applyOnPublicSignup);
    const trialDays = Math.min(3650, Math.max(1, Number(body.trialDays) || 14));

    let plan = null;
    const planId = body.planId || null;
    const planCode = String(body.planCode || '')
      .trim()
      .toLowerCase();

    if (planId) {
      plan = await Plan.findById(planId);
    } else if (planCode) {
      plan = await Plan.findOne({ code: planCode });
    }

    if (enabled || applyOnPublicSignup) {
      if (!plan) {
        throw new AppError('Select a valid plan for the free trial', HTTP_STATUS.BAD_REQUEST);
      }
      if (plan.status === 'Inactive' || plan.enabled === false) {
        throw new AppError('Trial plan must be an active enabled plan', HTTP_STATUS.BAD_REQUEST);
      }
      if (plan.priceCustom) {
        throw new AppError('Custom / contact-sales plans cannot be used for trials', HTTP_STATUS.BAD_REQUEST);
      }
    }

    const settings = await PlatformTrialSettings.findOneAndUpdate(
      { key: 'platform' },
      {
        $set: {
          enabled,
          applyOnPublicSignup: enabled ? applyOnPublicSignup : false,
          trialDays,
          planId: plan?._id || null,
          planCode: plan?.code || '',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return toView(settings, plan);
  }
}

module.exports = new PlatformTrialSettingsService();
