function formatPrice(plan) {
  if (plan.priceCustom) return 'Custom';
  const amount = Number(plan.priceAmount) || 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
  if (plan.billing === 'Yearly') return `${formatted} / yr`;
  if (plan.billing === 'Monthly') return `${formatted} / mo`;
  return formatted;
}

function billingPeriodLabel(billing) {
  if (billing === 'Yearly') return '/year';
  if (billing === 'Monthly') return '/month';
  return '';
}

function formatUsersLimit(plan) {
  if (plan.usersUnlimited) return 'Unlimited';
  return String(Number(plan.users) || 0);
}

function toPlanView(doc, extras = {}) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const featureDocs = Array.isArray(plain.features) ? plain.features : [];
  const featureIds = featureDocs.map((item) =>
    typeof item === 'object' && item?._id ? String(item._id) : String(item)
  );
  const featureDetails = featureDocs
    .filter((item) => item && typeof item === 'object' && item.name)
    .map((item) => ({
      id: String(item._id),
      name: item.name,
      code: item.code,
      category: item.category,
      description: item.description || '',
    }));

  const usersUnlimited = Boolean(plain.usersUnlimited);

  return {
    id: String(plain._id),
    _id: String(plain._id),
    name: plain.name,
    code: plain.code,
    priceAmount: Number(plain.priceAmount) || 0,
    mrpAmount: Number(plain.mrpAmount) || 0,
    priceCustom: Boolean(plain.priceCustom),
    price: formatPrice(plain),
    billing: plain.billing,
    featureIds,
    features: featureDetails,
    featureCount: featureIds.length,
    status: plain.status,
    users: usersUnlimited ? 0 : Number(plain.users) || 0,
    usersUnlimited,
    usersLimitLabel: formatUsersLimit({ users: plain.users, usersUnlimited }),
    activeUsers: Number(extras.activeUsers) || 0,
    discountLinked:
      extras.discountLinked !== undefined
        ? Number(extras.discountLinked) || 0
        : Number(plain.discountLinked) || 0,
    discountCode:
      extras.discountCode !== undefined
        ? extras.discountCode || ''
        : plain.discountCode || '',
    visibleWebsite: Boolean(plain.visibleWebsite),
    visibleSuperAdmin: Boolean(plain.visibleSuperAdmin),
    enabled: Boolean(plain.enabled),
    description: plain.description || '',
    ctaText: plain.ctaText || 'Get early access',
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

/** Slim public payload for /pricing — no admin-only fields. */
function toPublicPlanView(doc) {
  const view = toPlanView(doc);
  return {
    id: view.id,
    name: view.name,
    code: view.code,
    priceAmount: view.priceAmount,
    mrpAmount: view.mrpAmount,
    priceCustom: view.priceCustom,
    price: view.price,
    billing: view.billing,
    period: billingPeriodLabel(view.billing),
    description: view.description,
    ctaText: view.ctaText,
    features: (view.features || []).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description || '',
    })),
  };
}

function normalizePlanPayload(body = {}) {
  const featureIds = Array.isArray(body.featureIds)
    ? body.featureIds
    : Array.isArray(body.features)
      ? body.features
      : [];

  const usersUnlimited = Boolean(body.usersUnlimited);

  return {
    name: String(body.name || '').trim(),
    code: String(body.code || '')
      .trim()
      .toLowerCase(),
    priceAmount: body.priceCustom ? 0 : Number(body.priceAmount) || 0,
    mrpAmount: body.priceCustom ? 0 : Number(body.mrpAmount) || 0,
    priceCustom: Boolean(body.priceCustom),
    billing: ['Monthly', 'Yearly', 'Custom'].includes(body.billing) ? body.billing : 'Monthly',
    features: featureIds.filter(Boolean),
    status: body.status === 'Inactive' || body.enabled === false ? 'Inactive' : 'Active',
    users: usersUnlimited ? 0 : Math.max(0, Number(body.users) || 0),
    usersUnlimited,
    discountLinked: Number(body.discountLinked) || 0,
    discountCode: String(body.discountCode || '').trim(),
    visibleWebsite: Boolean(body.visibleWebsite),
    visibleSuperAdmin:
      body.visibleSuperAdmin === undefined ? true : Boolean(body.visibleSuperAdmin),
    enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    description: String(body.description || '').trim(),
    ctaText: String(body.ctaText || '').trim() || 'Get early access',
  };
}

module.exports = {
  formatPrice,
  billingPeriodLabel,
  formatUsersLimit,
  toPlanView,
  toPublicPlanView,
  normalizePlanPayload,
};
