const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');

const BILLING_CYCLES = ['All billing cycles', 'Monthly', 'Yearly', 'Custom'];
const ANY_PLAN = 'Any plan';

function formatDisplayDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  if (value === '' || value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  // Prefer YYYY-MM-DD as UTC midnight so round-trips stay stable
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00.000Z`);
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveLifecycle(discount, asOf = new Date()) {
  if (!discount.enabled) {
    return {
      lifecycle: 'Disabled',
      lifecycleNote: 'Discount is currently disabled',
    };
  }

  const start = discount.startDate ? new Date(discount.startDate) : null;
  const end = discount.endDate ? new Date(discount.endDate) : null;

  if (start && start > asOf) {
    return {
      lifecycle: 'Scheduled',
      lifecycleNote: `Starts on ${formatDisplayDate(start)}`,
    };
  }

  if (end && end < asOf) {
    return {
      lifecycle: 'Ended',
      lifecycleNote: 'Offer window has closed',
    };
  }

  if (discount.maxUses != null && Number(discount.usageUsed || 0) >= Number(discount.maxUses)) {
    return {
      lifecycle: 'Ended',
      lifecycleNote: 'Max uses reached',
    };
  }

  return {
    lifecycle: 'Active',
    lifecycleNote: 'Available for redemption right now',
  };
}

function formatOffer(discount) {
  if (discount.amountType === 'flat') {
    return `flat ₹${Number(discount.amountValue || 0).toLocaleString('en-IN')}`;
  }
  return `percentage ${Number(discount.amountValue || 0)}%`;
}

function toDiscountView(doc) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const { lifecycle, lifecycleNote } = resolveLifecycle(plain);
  const specificPlan = plain.specificPlan || ANY_PLAN;
  const billingCycle = plain.billingCycle || 'All billing cycles';

  return {
    id: String(plain._id),
    _id: String(plain._id),
    name: plain.name,
    code: plain.code,
    description: plain.description || '—',
    type: plain.type,
    amountType: plain.amountType,
    amountValue: plain.amountValue,
    offer: formatOffer(plain),
    planType: plain.planType || 'All plan types',
    specificPlan,
    billingCycle,
    appliesTo: [specificPlan, billingCycle].filter(Boolean),
    minOrderAmount: plain.minOrderAmount,
    maxUses: plain.maxUses,
    usageUsed: plain.usageUsed || 0,
    usageLimit: plain.maxUses,
    startDate: toInputDate(plain.startDate),
    endDate: toInputDate(plain.endDate),
    scheduleFrom: formatDisplayDate(plain.startDate) || 'Immediately',
    scheduleUntil: formatDisplayDate(plain.endDate) || 'No end',
    enabled: Boolean(plain.enabled),
    lifecycle,
    lifecycleNote,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

/** Slim public payload for /pricing — One Time Discount offers only. */
function toPublicDiscountView(doc) {
  const view = toDiscountView(doc);
  const remaining =
    view.maxUses == null ? null : Math.max(0, Number(view.maxUses) - Number(view.usageUsed || 0));

  return {
    id: view.id,
    name: view.name,
    code: view.code,
    description: view.description === '—' ? '' : view.description,
    amountType: view.amountType,
    amountValue: view.amountValue,
    offerLabel:
      view.amountType === 'flat'
        ? `₹${Number(view.amountValue || 0).toLocaleString('en-IN')} off`
        : `${Number(view.amountValue || 0)}% off`,
    specificPlan: view.specificPlan,
    billingCycle: view.billingCycle,
    scheduleUntil: view.scheduleUntil,
    remainingUses: remaining,
  };
}

function normalizePayload(body = {}) {
  const amountType =
    body.amountType === 'Flat (INR)' || body.amountType === 'flat' ? 'flat' : 'percentage';

  const billingCycle = BILLING_CYCLES.includes(body.billingCycle)
    ? body.billingCycle
    : 'All billing cycles';

  const payload = {
    name: String(body.name || '').trim(),
    code: String(body.code || '')
      .trim()
      .toUpperCase(),
    description: String(body.description || '').trim(),
    type: body.type || 'Simple discount',
    amountType,
    amountValue: Number(body.amountValue) || 0,
    planType: body.planType || 'All plan types',
    specificPlan: String(body.specificPlan || ANY_PLAN).trim() || ANY_PLAN,
    billingCycle,
    minOrderAmount:
      body.minOrderAmount === '' || body.minOrderAmount == null
        ? null
        : Number(body.minOrderAmount),
    maxUses: body.maxUses === '' || body.maxUses == null ? null : Number(body.maxUses),
    startDate: parseDateOnly(body.startDate),
    endDate: parseDateOnly(body.endDate),
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
  };

  if (body.affiliateUser) {
    payload.affiliateUser = body.affiliateUser;
  }

  return payload;
}

function assertDiscountRules(data) {
  if (!data.name) {
    throw new AppError('Discount name is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (!data.code) {
    throw new AppError('Promo code is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (Number.isNaN(data.amountValue) || data.amountValue < 0) {
    throw new AppError('Amount must be zero or greater', HTTP_STATUS.BAD_REQUEST);
  }
  if (data.amountType === 'percentage' && data.amountValue > 100) {
    throw new AppError('Percentage discount cannot exceed 100%', HTTP_STATUS.BAD_REQUEST);
  }
  if (
    data.minOrderAmount != null &&
    (Number.isNaN(data.minOrderAmount) || data.minOrderAmount < 0)
  ) {
    throw new AppError('Minimum order amount must be zero or greater', HTTP_STATUS.BAD_REQUEST);
  }
  if (data.maxUses != null && (Number.isNaN(data.maxUses) || data.maxUses < 0)) {
    throw new AppError('Max uses must be zero or greater', HTTP_STATUS.BAD_REQUEST);
  }
  if (data.type === 'One Time Discount') {
    if (data.maxUses == null || Number(data.maxUses) < 1) {
      throw new AppError(
        'One Time Discount requires Max uses (e.g. 10). The next user after that limit cannot use it.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw new AppError('End date must be on or after start date', HTTP_STATUS.BAD_REQUEST);
  }
  if (!BILLING_CYCLES.includes(data.billingCycle)) {
    throw new AppError('Invalid billing cycle', HTTP_STATUS.BAD_REQUEST);
  }
}

/**
 * Validate a discount against a purchase context.
 * Returns { ok, reason } or { ok, discountAmount, finalAmount }.
 */
function evaluateDiscount(discount, context = {}) {
  const view = typeof discount.toObject === 'function' ? discount.toObject() : discount;
  const asOf = context.asOf ? new Date(context.asOf) : new Date();
  const orderAmount = Number(context.orderAmount) || 0;
  const planName = String(context.planName || '').trim();
  const billingCycle = String(context.billingCycle || '').trim();

  if (!view.enabled) {
    return { ok: false, reason: 'Discount is disabled' };
  }

  const start = view.startDate ? new Date(view.startDate) : null;
  const end = view.endDate ? new Date(view.endDate) : null;
  if (start && start > asOf) {
    return { ok: false, reason: 'Discount has not started yet' };
  }
  if (end && end < asOf) {
    return { ok: false, reason: 'Discount has ended' };
  }

  if (view.maxUses != null && Number(view.usageUsed || 0) >= Number(view.maxUses)) {
    return {
      ok: false,
      reason:
        view.type === 'One Time Discount'
          ? 'This one-time discount has reached its user limit'
          : 'Discount max uses reached',
    };
  }

  const specificPlan = view.specificPlan || ANY_PLAN;
  if (specificPlan !== ANY_PLAN && planName && specificPlan.toLowerCase() !== planName.toLowerCase()) {
    return { ok: false, reason: `Discount only applies to ${specificPlan}` };
  }

  const cycle = view.billingCycle || 'All billing cycles';
  if (
    cycle !== 'All billing cycles' &&
    billingCycle &&
    cycle.toLowerCase() !== billingCycle.toLowerCase()
  ) {
    return { ok: false, reason: `Discount only applies to ${cycle} billing` };
  }

  if (view.minOrderAmount != null && orderAmount < Number(view.minOrderAmount)) {
    return {
      ok: false,
      reason: `Minimum order amount is ₹${Number(view.minOrderAmount).toLocaleString('en-IN')}`,
    };
  }

  let discountAmount = 0;
  if (view.amountType === 'flat') {
    discountAmount = Math.min(Number(view.amountValue) || 0, orderAmount);
  } else {
    const pct = Math.min(100, Math.max(0, Number(view.amountValue) || 0));
    discountAmount = Math.round((orderAmount * pct) / 100);
  }

  return {
    ok: true,
    discountAmount,
    finalAmount: Math.max(0, orderAmount - discountAmount),
    code: view.code,
  };
}

module.exports = {
  ANY_PLAN,
  BILLING_CYCLES,
  formatDisplayDate,
  toInputDate,
  parseDateOnly,
  resolveLifecycle,
  formatOffer,
  toDiscountView,
  toPublicDiscountView,
  normalizePayload,
  assertDiscountRules,
  evaluateDiscount,
};
