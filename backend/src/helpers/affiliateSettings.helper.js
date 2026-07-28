const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { AFFILIATE_TYPE_VALUES, AFFILIATE_TYPE_LABELS } = require('@constants/affiliateTypes');

const PAYMENT_CYCLES = ['monthly', 'quarterly', 'yearly'];

const DEFAULT_TYPE_CONFIG = {
  enabled: true,
  defaultDiscountPercent: 20,
  earningPercent: 20,
  minimumTargetValue: 0,
};

function defaultTypes() {
  return Object.fromEntries(
    AFFILIATE_TYPE_VALUES.map((type) => [type, { ...DEFAULT_TYPE_CONFIG }])
  );
}

const DEFAULT_AFFILIATE_SETTINGS = {
  paymentCycle: 'monthly',
  types: defaultTypes(),
};

function clampPercent(value, fallback = 20) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return fallback;
  return Math.min(100, n);
}

function clampMoney(value, fallback = 0) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return fallback;
  return n;
}

function normalizeTypeConfig(raw = {}, fallback = DEFAULT_TYPE_CONFIG) {
  const discountFallback = fallback.defaultDiscountPercent ?? 20;
  // Older docs may only have defaultDiscountPercent — seed earning from that once
  const earningFallback =
    raw.earningPercent !== undefined && raw.earningPercent !== null
      ? raw.earningPercent
      : raw.defaultDiscountPercent !== undefined && raw.defaultDiscountPercent !== null
        ? raw.defaultDiscountPercent
        : fallback.earningPercent ?? discountFallback;

  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : Boolean(fallback.enabled),
    defaultDiscountPercent: clampPercent(raw.defaultDiscountPercent, discountFallback),
    earningPercent: clampPercent(earningFallback, fallback.earningPercent ?? discountFallback),
    minimumTargetValue: clampMoney(
      raw.minimumTargetValue,
      fallback.minimumTargetValue ?? 0
    ),
  };
}

function toAffiliateSettingsView(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const types = {};
  for (const type of AFFILIATE_TYPE_VALUES) {
    types[type] = {
      ...normalizeTypeConfig(plain.types?.[type]),
      label: AFFILIATE_TYPE_LABELS[type] || type,
      value: type,
    };
  }

  return {
    id: String(plain._id || ''),
    key: plain.key || 'platform',
    paymentCycle: PAYMENT_CYCLES.includes(plain.paymentCycle)
      ? plain.paymentCycle
      : 'monthly',
    types,
    updatedAt: plain.updatedAt || null,
    createdAt: plain.createdAt || null,
  };
}

function toPublicAffiliateSettingsView(doc) {
  const full = toAffiliateSettingsView(doc);
  const enabledTypes = AFFILIATE_TYPE_VALUES.filter((type) => full.types[type]?.enabled).map(
    (type) => ({
      value: type,
      label: full.types[type].label,
      defaultDiscountPercent: full.types[type].defaultDiscountPercent,
      earningPercent: full.types[type].earningPercent,
      minimumTargetValue: full.types[type].minimumTargetValue,
    })
  );

  return {
    paymentCycle: full.paymentCycle,
    enabledTypes,
  };
}

function normalizeAffiliateSettingsPayload(body = {}) {
  const paymentCycle = PAYMENT_CYCLES.includes(body.paymentCycle)
    ? body.paymentCycle
    : 'monthly';

  const incomingTypes = body.types && typeof body.types === 'object' ? body.types : {};
  const types = {};

  for (const type of AFFILIATE_TYPE_VALUES) {
    types[type] = normalizeTypeConfig(incomingTypes[type]);
  }

  const enabledCount = AFFILIATE_TYPE_VALUES.filter((type) => types[type].enabled).length;
  if (enabledCount < 1) {
    throw new AppError('At least one affiliate type must stay enabled', HTTP_STATUS.BAD_REQUEST);
  }

  return { paymentCycle, types };
}

module.exports = {
  PAYMENT_CYCLES,
  DEFAULT_TYPE_CONFIG,
  DEFAULT_AFFILIATE_SETTINGS,
  toAffiliateSettingsView,
  toPublicAffiliateSettingsView,
  normalizeAffiliateSettingsPayload,
  normalizeTypeConfig,
};
