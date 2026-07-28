const { User } = require('@models');
const RoleRepository = require('@repositories/role.repository');
const DiscountRepository = require('@repositories/discount.repository');
const DiscountService = require('@services/discount.service');
const AffiliateSettingsService = require('@services/affiliateSettings.service');
const { ROLES } = require('@constants/roles');

/** Fallback if settings unavailable */
const AFFILIATE_DEFAULT_DISCOUNT_PERCENT = 20;

/**
 * Code format: {joinOrder}{FirstName}@{percent}%
 * Example: first partner "Srujan" → 1SRUJAN@20%
 */
function sanitizeNameForCode(name) {
  const cleaned = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return cleaned.slice(0, 24) || 'PARTNER';
}

function buildAffiliateDiscountCode({
  partnerNumber,
  firstName,
  percent = AFFILIATE_DEFAULT_DISCOUNT_PERCENT,
}) {
  const namePart = sanitizeNameForCode(firstName);
  const pct = Math.min(100, Math.max(1, Number(percent) || AFFILIATE_DEFAULT_DISCOUNT_PERCENT));
  return `${Number(partnerNumber)}${namePart}@${pct}%`.slice(0, 40).toUpperCase();
}

async function nextAffiliatePartnerNumber() {
  const role = await RoleRepository.findBySlug(ROLES.AFFILIATE);
  if (!role) return 1;

  const [row] = await User.aggregate([
    {
      $match: {
        role: role._id,
        affiliatePartnerNumber: { $type: 'number', $gt: 0 },
      },
    },
    { $group: { _id: null, max: { $max: '$affiliatePartnerNumber' } } },
  ]);

  return (row?.max || 0) + 1;
}

async function resolveDefaultDiscountPercent(user) {
  try {
    const config = await AffiliateSettingsService.getTypeConfig(user?.affiliateType);
    if (config && Number.isFinite(Number(config.defaultDiscountPercent))) {
      return Math.min(100, Math.max(0, Number(config.defaultDiscountPercent)));
    }
  } catch {
    // fall through
  }
  return AFFILIATE_DEFAULT_DISCOUNT_PERCENT;
}

/**
 * Ensure approved affiliate has a Partner discount (Any plan).
 * Percent comes from Affiliate Settings for that type (default 20%).
 */
async function ensureAffiliatePartnerDiscount(user) {
  if (!user?._id) return null;

  const percent =
    user.affiliateDiscountPercent != null && user.affiliateDiscountPercent !== ''
      ? Math.min(100, Math.max(0, Number(user.affiliateDiscountPercent)))
      : await resolveDefaultDiscountPercent(user);

  if (user.affiliateDiscountCode) {
    const existing = await DiscountRepository.findByCode(user.affiliateDiscountCode);
    if (existing) {
      return {
        code: existing.code,
        percent: Number(existing.amountValue) || percent,
        partnerNumber: user.affiliatePartnerNumber || null,
        discountId: existing._id,
      };
    }
  }

  const partnerNumber =
    user.affiliatePartnerNumber > 0
      ? user.affiliatePartnerNumber
      : await nextAffiliatePartnerNumber();

  let code = buildAffiliateDiscountCode({
    partnerNumber,
    firstName: user.firstName,
    percent,
  });

  let attempt = 0;
  while (await DiscountRepository.findByCode(code)) {
    attempt += 1;
    const suffix = attempt === 1 ? String(partnerNumber) : `${partnerNumber}${attempt}`;
    const namePart = sanitizeNameForCode(user.firstName).slice(0, 18);
    code = `${partnerNumber}${namePart}${suffix}@${percent}%`.slice(0, 40).toUpperCase();
    if (attempt > 20) {
      code = `${partnerNumber}P${Date.now().toString(36).toUpperCase()}@${percent}%`.slice(0, 40);
      break;
    }
  }

  const displayName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email;

  const discount = await DiscountService.create({
    name: `Partner — ${displayName}`.slice(0, 120),
    code,
    description: `Auto-created affiliate partner discount (${percent}% on all plans) for ${user.email}`,
    type: 'Partner discount',
    amountType: 'percentage',
    amountValue: percent,
    planType: 'All plan types',
    specificPlan: 'Any plan',
    billingCycle: 'All billing cycles',
    enabled: true,
    affiliateUser: user._id,
  });

  await User.findByIdAndUpdate(user._id, {
    $set: {
      affiliatePartnerNumber: partnerNumber,
      affiliateDiscountCode: discount.code,
      affiliateDiscountPercent: percent,
    },
  });

  return {
    code: discount.code,
    percent,
    partnerNumber,
    discountId: discount._id || discount.id,
  };
}

/**
 * Update an existing partner Discount's % when Super Admin edits an affiliate.
 * Keeps the same code string so past attributed payments still match.
 */
async function syncAffiliatePartnerDiscountPercent(user, percent) {
  if (!user?._id) return null;
  const pct = Math.min(100, Math.max(0, Number(percent)));
  if (Number.isNaN(pct)) return null;

  const code = String(user.affiliateDiscountCode || '')
    .trim()
    .toUpperCase();
  if (!code) return null;

  const existing = await DiscountRepository.findByCode(code);
  if (!existing) return null;

  await DiscountService.update(String(existing._id), {
    amountValue: pct,
    description: `Affiliate partner discount (${pct}% on all plans) for ${user.email}`,
  });

  return { code, percent: pct, discountId: existing._id };
}

module.exports = {
  AFFILIATE_DEFAULT_DISCOUNT_PERCENT,
  sanitizeNameForCode,
  buildAffiliateDiscountCode,
  nextAffiliatePartnerNumber,
  ensureAffiliatePartnerDiscount,
  resolveDefaultDiscountPercent,
  syncAffiliatePartnerDiscountPercent,
};
