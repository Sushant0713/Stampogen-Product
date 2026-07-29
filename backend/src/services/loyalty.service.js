const AppError = require('@utils/AppError');
const { HTTP_STATUS, TENANT_STATUS, LOYALTY_STAMP_MODES } = require('@constants');
const TenantRepository = require('@repositories/tenant.repository');
const LoyaltyMembershipRepository = require('@repositories/loyaltyMembership.repository');
const NotificationService = require('@services/notification.service');

const DEFAULT_CAMPAIGN = {
  campaignName: 'Loyalty Club',
  rewardTitle: 'Reward',
  stampsRequired: 5,
};

/** Legacy auto-seeded offer keys — stripped from catalogs and memberships. */
const LEGACY_DEFAULT_OFFER_KEYS = new Set(['free_reward', 'percent_off']);

const OFFER_COLORS = ['#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#021A54', '#14B8A6'];

function shopInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function customerName(user) {
  if (!user) return 'Customer';
  const name = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || 'Customer';
}

function formatAddress(tenant) {
  const bp = tenant?.billingProfile || {};
  const line = [bp.street || bp.address, bp.city, bp.state, bp.pin].filter(Boolean).join(', ');
  return line || '';
}

const SOCIAL_LINK_KEYS = ['facebook', 'instagram', 'x', 'youtube', 'whatsapp', 'googleReview'];

function normalizeSocialLinks(input = {}) {
  const out = {};
  SOCIAL_LINK_KEYS.forEach((key) => {
    const raw = String(input?.[key] ?? '').trim().slice(0, 500);
    out[key] = raw;
  });
  return out;
}

function readSocialLinks(tenant) {
  const links = tenant?.socialLinks || {};
  return normalizeSocialLinks(links);
}

function publicSocialLinks(tenant) {
  const links = readSocialLinks(tenant);
  const out = {};
  SOCIAL_LINK_KEYS.forEach((key) => {
    if (links[key]) out[key] = links[key];
  });
  return out;
}

/** Calendar parts in Asia/Kolkata for QR scan month buckets. */
function getIndiaDateParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const monthKey = `${parts.year}-${parts.month}`;
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  return { year, month, day, monthKey, dateKey, daysInMonth, monthLabel };
}

function buildQrScanDays(daysInMonth, monthKey, byDay = {}, upToDay = daysInMonth) {
  const map = byDay && typeof byDay === 'object' ? byDay : {};
  const days = [];
  let total = 0;
  const last = Math.min(daysInMonth, Math.max(1, upToDay));
  for (let d = 1; d <= last; d += 1) {
    const dateKey = `${monthKey}-${String(d).padStart(2, '0')}`;
    const count = Math.max(0, Number(map[dateKey]) || 0);
    total += count;
    days.push({
      date: dateKey,
      day: d,
      label: String(d),
      count,
    });
  }
  return { days, total };
}

function slugifyOfferKey(title = '') {
  const base = String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return base || `offer_${Date.now()}`;
}

function parseOfferDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeMaxCustomers(value) {
  if (value === null || value === undefined || value === '' || value === 'infinity') {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function isOfferCurrentlyValid(offer, now = new Date()) {
  if (!offer) return false;
  const start = offer.startDate ? new Date(offer.startDate) : null;
  const end = offer.validUntil ? new Date(offer.validUntil) : null;
  if (start && now < start) return false;
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (now > endOfDay) return false;
  }
  return true;
}

function countEnrolledCustomers(memberships, offerKey) {
  return (memberships || []).filter((m) =>
    (m.offers || []).some((o) => o.key === offerKey)
  ).length;
}

function isOfferAtCapacity(offer, enrolledCount) {
  if (offer?.maxCustomers == null) return false;
  return enrolledCount >= offer.maxCustomers;
}

/** Pause active offers that have reached maxCustomers. Returns updated catalog + paused keys. */
function applyCapacityPauses(catalog, enrolledCounts = {}) {
  const pausedKeys = [];
  const next = (catalog || []).map((o) => {
    if (o.status === 'active' && isOfferAtCapacity(o, enrolledCounts[o.key] || 0)) {
      pausedKeys.push(o.key);
      return { ...o, status: 'paused' };
    }
    return o;
  });
  return { catalog: next, pausedKeys };
}

function normalizeCatalogOffer(o) {
  return {
    key: o.key,
    title: o.title,
    stampsRequired: Math.max(1, Number(o.stampsRequired) || 5),
    status: o.status === 'paused' ? 'paused' : 'active',
    color: o.color || '#3B82F6',
    createdAt: o.createdAt || null,
    startDate: parseOfferDate(o.startDate),
    validUntil: parseOfferDate(o.validUntil),
    minOrderValue: Math.max(0, Number(o.minOrderValue) || 0),
    maxCustomers: normalizeMaxCustomers(o.maxCustomers),
  };
}

function formatAdminOffer(offer, { redemptions = 0, customerCount = 0 } = {}) {
  return {
    ...offer,
    stampsLabel: `${offer.stampsRequired} stamps to reward`,
    redemptions,
    customerCount,
    maxCustomersLabel:
      offer.maxCustomers == null ? 'Unlimited' : String(offer.maxCustomers),
    dateLabel: formatOfferDateLabel(offer),
    minOrderLabel:
      offer.minOrderValue > 0
        ? `Min order ₹${offer.minOrderValue.toLocaleString('en-IN')}`
        : 'No minimum order',
  };
}

function buildEnrolledCounts(memberships) {
  const counts = {};
  (memberships || []).forEach((m) => {
    const keys = new Set((m.offers || []).map((o) => o.key));
    keys.forEach((key) => {
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return counts;
}

function validateOfferSchedule(startDate, validUntil) {
  const start = parseOfferDate(startDate);
  const end = parseOfferDate(validUntil);
  if (start && end && end < start) {
    throw new AppError('Valid until date must be on or after start date', HTTP_STATUS.BAD_REQUEST);
  }
  return { startDate: start, validUntil: end };
}

function formatOfferDateLabel(offer) {
  const fmt = (d) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  if (offer.startDate && offer.validUntil) {
    return `${fmt(offer.startDate)} – ${fmt(offer.validUntil)}`;
  }
  if (offer.startDate) return `From ${fmt(offer.startDate)}`;
  if (offer.validUntil) return `Until ${fmt(offer.validUntil)}`;
  return 'No date limit';
}

function defaultCatalogOffers() {
  return [];
}

function readCatalog(tenant) {
  if (!Array.isArray(tenant?.loyaltyOffers)) {
    return [];
  }
  return tenant.loyaltyOffers
    .map(normalizeCatalogOffer)
    .filter((o) => !LEGACY_DEFAULT_OFFER_KEYS.has(o.key));
}

function buildOffersFromCatalog(
  catalog,
  {
    stamps = 0,
    stampsRequired = 5,
    rewardTitle = 'Reward',
    rewardStatus = 'collecting',
    enrolledCounts = null,
  } = {}
) {
  const counts = enrolledCounts ? { ...enrolledCounts } : null;
  const active = (catalog || []).filter((o) => {
    if (o.status !== 'active' || !isOfferCurrentlyValid(o)) return false;
    if (!counts) return true;
    if (isOfferAtCapacity(o, counts[o.key] || 0)) return false;
    counts[o.key] = (counts[o.key] || 0) + 1;
    return true;
  });
  if (!active.length) return [];
  return active.map((def, index) => {
    if (index === 0 && stamps > 0) {
      return {
        key: def.key,
        title: rewardTitle || def.title,
        stamps: Math.min(stamps || 0, stampsRequired || def.stampsRequired),
        stampsRequired: stampsRequired || def.stampsRequired,
        rewardStatus: rewardStatus || 'collecting',
        verifiedAt: null,
        redeemedAt: null,
      };
    }
    return {
      key: def.key,
      title: def.title,
      stamps: 0,
      stampsRequired: def.stampsRequired,
      rewardStatus: 'collecting',
      verifiedAt: null,
      redeemedAt: null,
    };
  });
}

function buildDefaultOffers(opts = {}) {
  return buildOffersFromCatalog(defaultCatalogOffers(), opts);
}

function ensureOffers(membership) {
  const catalog = readCatalog(membership.tenant);
  const catalogKeys = new Set(catalog.map((c) => c.key));

  if (Array.isArray(membership.offers) && membership.offers.length > 0) {
    return membership.offers
      .filter((o) => !LEGACY_DEFAULT_OFFER_KEYS.has(o.key) && (catalogKeys.size === 0 || catalogKeys.has(o.key)))
      .map((o) => ({
        key: o.key,
        title: o.title,
        stamps: o.stamps || 0,
        stampsRequired: o.stampsRequired || 5,
        rewardStatus: o.rewardStatus || 'collecting',
        verifiedAt: o.verifiedAt || null,
        redeemedAt: o.redeemedAt || null,
      }));
  }
  if (!catalog.length) return [];
  return buildOffersFromCatalog(catalog, {
    stamps: membership.stamps,
    stampsRequired: membership.stampsRequired,
    rewardTitle: membership.rewardTitle,
    rewardStatus: membership.rewardStatus,
  });
}

function mergeOffersWithCatalog(membership, catalog, { enrolledCounts = {} } = {}) {
  const existing = ensureOffers(membership);
  const byKey = new Map(existing.map((o) => [o.key, { ...o }]));
  let changed = false;

  (catalog || [])
    .filter((c) => c.status === 'active' && isOfferCurrentlyValid(c))
    .forEach((c) => {
      const cur = byKey.get(c.key);
      if (!cur) {
        const enrolled = enrolledCounts[c.key] || 0;
        if (isOfferAtCapacity(c, enrolled)) return;
        byKey.set(c.key, {
          key: c.key,
          title: c.title,
          stamps: 0,
          stampsRequired: c.stampsRequired,
          rewardStatus: 'collecting',
          verifiedAt: null,
          redeemedAt: null,
        });
        enrolledCounts[c.key] = enrolled + 1;
        changed = true;
        return;
      }
      if (cur.title !== c.title || cur.stampsRequired !== c.stampsRequired) {
        byKey.set(c.key, {
          ...cur,
          title: c.title,
          stampsRequired: c.stampsRequired,
          stamps: Math.min(cur.stamps || 0, c.stampsRequired),
        });
        changed = true;
      }
    });

  return { offers: Array.from(byKey.values()), changed };
}

function customerVisibleOffers(membershipOffers, catalog) {
  const catalogByKey = new Map((catalog || []).map((c) => [c.key, c]));

  return membershipOffers.filter((o) => {
    const cat = catalogByKey.get(o.key);
    if (!cat) return false;
    // Paused offers are hidden from customers entirely
    if (cat.status === 'paused') return false;

    const hasProgress =
      (o.stamps || 0) > 0 || ['pending', 'verified', 'redeemed'].includes(o.rewardStatus);

    if (!isOfferCurrentlyValid(cat)) return hasProgress;
    return true;
  });
}

function resolveOfferKey({ offerKey, offerTitle, offers }) {
  const key = String(offerKey || '').trim();
  if (key) {
    const byKey = offers.find((o) => o.key === key);
    if (byKey) return byKey.key;
  }
  const title = String(offerTitle || '').trim().toLowerCase();
  if (title) {
    const byTitle = offers.find((o) => String(o.title).toLowerCase() === title);
    if (byTitle) return byTitle.key;
    if (title.includes('10%') || title.includes('percent')) return 'percent_off';
    if (title.includes('free') || title.includes('reward')) return 'free_reward';
  }
  return offers[0]?.key || 'free_reward';
}

function readStampMode(tenant) {
  const mode = tenant?.loyaltyStampMode;
  return mode === LOYALTY_STAMP_MODES.REQUEST ? LOYALTY_STAMP_MODES.REQUEST : LOYALTY_STAMP_MODES.BILL;
}

function hasPendingStampRequest(membership, offerKey) {
  return (membership?.stampRequests || []).some(
    (r) => r.offerKey === offerKey && r.status === 'pending'
  );
}

function formatOffer(o, { stampRequestPending = false, catalogOffer = null } = {}) {
  const stampsRequired = o.stampsRequired || 5;
  const stamps = Math.min(o.stamps || 0, stampsRequired);
  return {
    key: o.key,
    title: o.title,
    stamps,
    stampsRequired,
    progressText: `${stamps} of ${stampsRequired} stamps`,
    rewardStatus: o.rewardStatus || 'collecting',
    isRedeemable: stamps >= stampsRequired,
    stampRequestPending,
    minOrderValue: catalogOffer?.minOrderValue || 0,
    startDate: catalogOffer?.startDate || null,
    validUntil: catalogOffer?.validUntil || null,
    canEarn:
      stamps < stampsRequired &&
      !['pending', 'verified'].includes(o.rewardStatus) &&
      !stampRequestPending &&
      catalogOffer?.status === 'active' &&
      isOfferCurrentlyValid(catalogOffer),
  };
}

function formatCard(membership, catalog) {
  const tenant = membership.tenant;
  const cat = catalog || readCatalog(tenant);
  const stampMode = readStampMode(tenant);
  const catalogByKey = new Map(cat.map((c) => [c.key, c]));
  const offers = customerVisibleOffers(ensureOffers(membership), cat).map((o) =>
    formatOffer(o, {
      stampRequestPending: hasPendingStampRequest(membership, o.key),
      catalogOffer: catalogByKey.get(o.key),
    })
  );
  const primary = offers[0] || {
    title: DEFAULT_CAMPAIGN.rewardTitle,
    stamps: 0,
    stampsRequired: DEFAULT_CAMPAIGN.stampsRequired,
    progressText: '0 of 5 stamps',
    rewardStatus: 'collecting',
  };

  return {
    id: String(membership._id),
    tenantId: String(tenant._id),
    slug: tenant.slug,
    name: tenant.name,
    initials: shopInitials(tenant.name),
    stampMode,
    campaign: membership.campaignName || DEFAULT_CAMPAIGN.campaignName,
    reward: primary.title,
    badgeLabel: primary.title,
    stampsRequired: primary.stampsRequired,
    stamps: primary.stamps,
    progressText: primary.progressText,
    joinedAt: membership.joinedAt,
    lastStampAt: membership.lastStampAt,
    isRedeemable: offers.some((o) => o.isRedeemable && o.rewardStatus !== 'redeemed'),
    rewardStatus: primary.rewardStatus,
    validUntil: primary.validUntil || null,
    category: tenant.category || null,
    customCategory: tenant.customCategory || '',
    memberId: `${shopInitials(tenant.name)}-${String(membership._id).slice(-5).toUpperCase()}`,
    offers,
    address: formatAddress(tenant),
    socialLinks: publicSocialLinks(tenant),
  };
}

function formatAdminOfferRow(membership, offer, { includeBills = false, bills = [] } = {}) {
  const user = membership.user || {};
  const offerBills = includeBills
    ? bills.filter((b) => b.offerKey === offer.key || (!b.offerKey && offer.key === 'free_reward'))
    : [];

  return {
    id: `${membership._id}:${offer.key}`,
    membershipId: String(membership._id),
    offerKey: offer.key,
    name: customerName(user),
    email: user.email || '',
    phone: user.phone || '',
    avatar: user.avatar || null,
    offer: offer.title,
    reward: offer.title,
    campaign: membership.campaignName || DEFAULT_CAMPAIGN.campaignName,
    stamps: offer.stamps || 0,
    stampsRequired: offer.stampsRequired || 5,
    billCount: includeBills ? offerBills.length : undefined,
    rewardStatus: offer.rewardStatus || 'collecting',
    verified: offer.rewardStatus === 'verified' || offer.rewardStatus === 'redeemed',
    redeemed: offer.rewardStatus === 'redeemed',
    verifiedAt: offer.verifiedAt,
    redeemedAt: offer.redeemedAt,
    lastStampAt: membership.lastStampAt,
    updatedAt: membership.updatedAt,
    bills: includeBills
      ? offerBills.map((b) => ({
          id: String(b._id),
          document: b.document,
          documentName: b.documentName,
          offerTitle: b.offerTitle,
          offerKey: b.offerKey,
          stampedAt: b.stampedAt,
        }))
      : undefined,
  };
}

class LoyaltyService {
  async ensureTenantCatalog(tenant) {
    return tenant;
  }

  async getCatalogForTenant(tenantOrId) {
    let tenant = tenantOrId;
    if (!tenant?.loyaltyOffers && tenantOrId) {
      const id = tenantOrId._id || tenantOrId;
      tenant = await TenantRepository.findById(id);
    }
    if (!tenant) throw new AppError('Shop organization not found', HTTP_STATUS.BAD_REQUEST);
    tenant = await this.ensureTenantCatalog(tenant);

    const raw = tenant.loyaltyOffers || [];
    if (raw.some((o) => LEGACY_DEFAULT_OFFER_KEYS.has(o.key))) {
      tenant = await TenantRepository.updateById(tenant._id, {
        loyaltyOffers: raw.filter((o) => !LEGACY_DEFAULT_OFFER_KEYS.has(o.key)),
      });
    }

    return { tenant, catalog: readCatalog(tenant) };
  }

  async scrubLegacyMembership(membership) {
    const raw = membership.offers || [];
    const hasLegacy = raw.some((o) => LEGACY_DEFAULT_OFFER_KEYS.has(o.key));
    if (!hasLegacy) return membership;

    const offers = ensureOffers(membership);
    return LoyaltyMembershipRepository.updateById(membership._id, {
      offers,
      stamps: offers[0]?.stamps || 0,
      rewardStatus: offers[0]?.rewardStatus || 'collecting',
      stampRequests: (membership.stampRequests || []).filter(
        (r) => !LEGACY_DEFAULT_OFFER_KEYS.has(r.offerKey)
      ),
    });
  }

  async pauseOffersAtCapacity(tenantId, catalog, enrolledCounts) {
    const { catalog: next, pausedKeys } = applyCapacityPauses(catalog, enrolledCounts);
    if (!pausedKeys.length) return catalog;
    await TenantRepository.updateById(tenantId, { loyaltyOffers: next });
    return next;
  }

  async syncMembershipCatalog(membership, catalog, enrolledCounts = null) {
    let counts = enrolledCounts;
    const tenantId = membership.tenant?._id || membership.tenant;
    if (!counts) {
      const rows = tenantId ? await LoyaltyMembershipRepository.findByTenant(tenantId) : [];
      counts = buildEnrolledCounts(rows);
    }
    const workingCounts = { ...counts };
    const { offers, changed } = mergeOffersWithCatalog(membership, catalog, {
      enrolledCounts: workingCounts,
    });
    if (tenantId) {
      await this.pauseOffersAtCapacity(tenantId, catalog, workingCounts);
    }
    if (!changed && Array.isArray(membership.offers) && membership.offers.length > 0) {
      return membership;
    }
    return LoyaltyMembershipRepository.updateById(membership._id, { offers });
  }

  async pushOfferToMembers(tenantId, offer) {
    if (!isOfferCurrentlyValid(offer) || offer.status === 'paused') return;
    const rows = await LoyaltyMembershipRepository.findByTenant(tenantId);
    const enrolledCounts = buildEnrolledCounts(rows);
    // Sequential so capacity is respected accurately
    for (const membership of rows) {
      const offers = ensureOffers(membership);
      if (offers.some((o) => o.key === offer.key)) continue;
      if (isOfferAtCapacity(offer, enrolledCounts[offer.key] || 0)) break;
      offers.push({
        key: offer.key,
        title: offer.title,
        stamps: 0,
        stampsRequired: offer.stampsRequired,
        rewardStatus: 'collecting',
        verifiedAt: null,
        redeemedAt: null,
      });
      enrolledCounts[offer.key] = (enrolledCounts[offer.key] || 0) + 1;
      await LoyaltyMembershipRepository.updateById(membership._id, { offers });
    }

    const { catalog } = await this.getCatalogForTenant(tenantId);
    await this.pauseOffersAtCapacity(tenantId, catalog, enrolledCounts);
  }

  async getShopPreview(slug) {
    const tenant = await TenantRepository.findBySlug(String(slug || '').toLowerCase().trim());
    if (!tenant) {
      throw new AppError('Shop not found', HTTP_STATUS.NOT_FOUND);
    }
    if (tenant.status === TENANT_STATUS.SUSPENDED || tenant.status === TENANT_STATUS.INACTIVE) {
      throw new AppError('This shop is not accepting new members', HTTP_STATUS.FORBIDDEN);
    }

    // Count loyalty QR opens (join page) — non-blocking
    void this.recordLoyaltyQrScan(tenant._id).catch(() => {});

    const { catalog } = await this.getCatalogForTenant(tenant);
    const active = catalog.filter((o) => o.status === 'active' && isOfferCurrentlyValid(o));

    return {
      slug: tenant.slug,
      name: tenant.name,
      initials: shopInitials(tenant.name),
      stampMode: readStampMode(tenant),
      campaign: DEFAULT_CAMPAIGN.campaignName,
      reward: active[0]?.title || DEFAULT_CAMPAIGN.rewardTitle,
      stampsRequired: active[0]?.stampsRequired || DEFAULT_CAMPAIGN.stampsRequired,
      offers: active.map((o) => ({
        key: o.key,
        title: o.title,
        stampsRequired: o.stampsRequired,
        minOrderValue: o.minOrderValue,
        startDate: o.startDate,
        validUntil: o.validUntil,
        maxCustomers: o.maxCustomers,
      })),
    };
  }

  async recordLoyaltyQrScan(tenantId) {
    if (!tenantId) return;
    const { monthKey, dateKey } = getIndiaDateParts();
    const row = await TenantRepository.findQrScanStats(tenantId);
    if (!row) return;

    if (row.loyaltyQrScanMonth !== monthKey) {
      await TenantRepository.resetQrScanMonth(tenantId, monthKey, { [dateKey]: 1 });
      return;
    }

    await TenantRepository.incrementQrScanDay(tenantId, dateKey);
  }

  async getLoyaltyQrScanStats(tenantId) {
    const { monthKey, day, daysInMonth, monthLabel } = getIndiaDateParts();
    let row = await TenantRepository.findQrScanStats(tenantId);

    if (!row || row.loyaltyQrScanMonth !== monthKey) {
      // New month — clear previous month's counters automatically
      if (row) {
        await TenantRepository.resetQrScanMonth(tenantId, monthKey, {});
      }
      const empty = buildQrScanDays(daysInMonth, monthKey, {}, day);
      return {
        month: monthKey,
        monthLabel,
        total: 0,
        days: empty.days,
      };
    }

    const built = buildQrScanDays(daysInMonth, monthKey, row.loyaltyQrScansByDay || {}, day);
    return {
      month: monthKey,
      monthLabel,
      total: built.total,
      days: built.days,
    };
  }

  async resolveActiveTenant(slug) {
    const tenant = await TenantRepository.findBySlug(String(slug || '').toLowerCase().trim());
    if (!tenant) {
      throw new AppError('Shop not found', HTTP_STATUS.NOT_FOUND);
    }
    if (tenant.status === TENANT_STATUS.SUSPENDED || tenant.status === TENANT_STATUS.INACTIVE) {
      throw new AppError('This shop is not available', HTTP_STATUS.FORBIDDEN);
    }
    return tenant;
  }

  async getAdminTenantId(adminUser) {
    const tenantId = adminUser?.tenant?._id || adminUser?.tenant;
    if (!tenantId) {
      throw new AppError('Shop organization not found', HTTP_STATUS.BAD_REQUEST);
    }
    return tenantId;
  }

  async getAdminMembership(adminUser, membershipId) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const membership = await LoyaltyMembershipRepository.findById(membershipId);
    if (!membership) {
      throw new AppError('Customer not found', HTTP_STATUS.NOT_FOUND);
    }
    if (String(membership.tenant._id || membership.tenant) !== String(tenantId)) {
      throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
    }
    return membership;
  }

  assertMembershipActive(membership) {
    if (membership?.status === 'inactive') {
      throw new AppError(
        'Your loyalty account at this shop is suspended. Contact the shop for help.',
        HTTP_STATUS.FORBIDDEN
      );
    }
  }

  async persistOffersIfNeeded(membership) {
    if (Array.isArray(membership.offers) && membership.offers.length > 0) {
      return membership;
    }
    const catalog = readCatalog(membership.tenant);
    const offers = ensureOffers(membership);
    if (offers.length) {
      return LoyaltyMembershipRepository.updateById(membership._id, { offers });
    }
    const tenantId = membership.tenant?._id || membership.tenant;
    const rows = tenantId ? await LoyaltyMembershipRepository.findByTenant(tenantId) : [];
    const enrolledCounts = buildEnrolledCounts(rows);
    const nextOffers = buildOffersFromCatalog(catalog, { enrolledCounts });
    const updated = await LoyaltyMembershipRepository.updateById(membership._id, {
      offers: nextOffers,
    });
    if (tenantId) {
      const nextCounts = buildEnrolledCounts([
        ...rows.filter((r) => String(r._id) !== String(membership._id)),
        { offers: nextOffers },
      ]);
      await this.pauseOffersAtCapacity(tenantId, catalog, nextCounts);
    }
    return updated;
  }

  async joinShop(userId, slug) {
    let tenant = await this.resolveActiveTenant(slug);
    let { catalog } = await this.getCatalogForTenant(tenant);
    tenant = await TenantRepository.findById(tenant._id);

    let membership = await LoyaltyMembershipRepository.findByUserAndTenant(userId, tenant._id);
    if (membership) {
      membership = await this.syncMembershipCatalog(membership, catalog);
      return {
        card: formatCard(membership, catalog),
        alreadyMember: true,
      };
    }

    const rows = await LoyaltyMembershipRepository.findByTenant(tenant._id);
    const enrolledCounts = buildEnrolledCounts(rows);
    const offers = buildOffersFromCatalog(catalog, { enrolledCounts });

    membership = await LoyaltyMembershipRepository.create({
      user: userId,
      tenant: tenant._id,
      ...DEFAULT_CAMPAIGN,
      rewardStatus: 'collecting',
      offers,
    });
    membership = await LoyaltyMembershipRepository.findByUserAndTenant(userId, tenant._id);

    const nextCounts = buildEnrolledCounts([...(rows || []), membership]);
    catalog = await this.pauseOffersAtCapacity(tenant._id, catalog, nextCounts);

    return {
      card: formatCard(membership, catalog),
      alreadyMember: false,
    };
  }

  async listCards(userId) {
    const memberships = await LoyaltyMembershipRepository.findByUser(userId);
    const out = [];
    for (const m of memberships) {
      if (!m.tenant || m.tenant.status !== TENANT_STATUS.ACTIVE) continue;
      const { catalog } = await this.getCatalogForTenant(m.tenant);
      const synced = await this.syncMembershipCatalog(m, catalog);
      out.push(formatCard(synced, catalog));
    }
    return out;
  }

  async getCard(userId, slug) {
    const tenant = await this.resolveActiveTenant(slug);
    const { catalog } = await this.getCatalogForTenant(tenant);
    let membership = await LoyaltyMembershipRepository.findByUserAndTenant(userId, tenant._id);
    if (!membership) {
      throw new AppError('You have not joined this shop yet', HTTP_STATUS.NOT_FOUND);
    }
    this.assertMembershipActive(membership);
    membership = await this.syncMembershipCatalog(membership, catalog);
    return formatCard(membership, catalog);
  }

  async listRewards(userId) {
    const cards = await this.listCards(userId);
    const gradients = [
      'linear-gradient(135deg,#021A54,#3B82F6)',
      'linear-gradient(135deg,#7C2D12,#F59E0B)',
      'linear-gradient(135deg,#581C87,#C084FC)',
      'linear-gradient(135deg,#134E4A,#2DD4BF)',
    ];

    const rows = [];
    cards.forEach((card) => {
      (card.offers || []).forEach((offer, index) => {
        rows.push({
          id: `${card.id}:${offer.key}`,
          slug: card.slug,
          title: offer.title,
          shopName: card.name,
          requirement: `${offer.stampsRequired} Stamps`,
          address: card.address,
          gradient: gradients[index % gradients.length],
          stamps: offer.stamps,
          stampsRequired: offer.stampsRequired,
          isRedeemable: offer.isRedeemable,
          rewardStatus: offer.rewardStatus,
        });
      });
    });
    return rows;
  }

  async addStamp(userId, slug, { offerKey, offerTitle, billDocument, billDocumentName } = {}) {
    const tenant = await this.resolveActiveTenant(slug);
    if (readStampMode(tenant) !== LOYALTY_STAMP_MODES.BILL) {
      throw new AppError(
        'This shop uses stamp requests. Ask the shop to approve your visit instead of uploading a bill.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    let membership = await LoyaltyMembershipRepository.findByUserAndTenant(userId, tenant._id);
    if (!membership) {
      throw new AppError('Join this shop before collecting stamps', HTTP_STATUS.NOT_FOUND);
    }
    this.assertMembershipActive(membership);
    membership = await this.persistOffersIfNeeded(membership);

    const bill = String(billDocument || '').trim();
    if (!bill.startsWith('data:image/') || bill.length < 32) {
      throw new AppError('Please take a photo of your bill to collect a stamp', HTTP_STATUS.BAD_REQUEST);
    }
    if (bill.length > 7_000_000) {
      throw new AppError('Bill file is too large (max 5MB)', HTTP_STATUS.BAD_REQUEST);
    }

    const offers = ensureOffers(membership);
    const key = resolveOfferKey({ offerKey, offerTitle, offers });
    const offerIndex = offers.findIndex((o) => o.key === key);
    if (offerIndex < 0) {
      throw new AppError('Offer not found', HTTP_STATUS.NOT_FOUND);
    }

    const catalogOffer = readCatalog(tenant).find((o) => o.key === key);
    if (!catalogOffer || catalogOffer.status === 'paused' || !isOfferCurrentlyValid(catalogOffer)) {
      throw new AppError('This offer is not available right now', HTTP_STATUS.BAD_REQUEST);
    }

    const offer = offers[offerIndex];
    if (['pending', 'verified'].includes(offer.rewardStatus)) {
      throw new AppError(
        'This offer is waiting for the shop to verify. New stamps are paused.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    if ((offer.stamps || 0) >= offer.stampsRequired) {
      throw new AppError('This offer is already complete — wait for shop verification', HTTP_STATUS.BAD_REQUEST);
    }

    const nextStamps = (offer.stamps || 0) + 1;
    const nextStatus = nextStamps >= offer.stampsRequired ? 'pending' : 'collecting';
    offers[offerIndex] = {
      ...offer,
      stamps: nextStamps,
      rewardStatus: nextStatus,
    };

    const offerLabel = String(offerTitle || offer.title || '').trim().slice(0, 200);
    const fileName = String(billDocumentName || 'bill.jpg').trim().slice(0, 200);

    const updated = await LoyaltyMembershipRepository.addStampWithBill(membership._id, {
      offerKey: key,
      offerTitle: offerLabel,
      billDocument: bill,
      billDocumentName: fileName,
      offers,
      primaryStamps: offers[0]?.stamps || 0,
      primaryRewardStatus: offers[0]?.rewardStatus || 'collecting',
    });

    try {
      const tenantDoc = await TenantRepository.findById(tenant._id);
      const ownerId = tenantDoc?.owner?._id || tenantDoc?.owner;
      const UserRepository = require('@repositories/user.repository');
      const customer = await UserRepository.findById(userId);
      const customerLabel = customerName(customer || {});
      if (ownerId) {
        await NotificationService.notifyUser({
          userId: ownerId,
          type: 'bill_stamp',
          title: 'New bill stamp',
          message: `${customerLabel} collected a stamp for “${offerLabel}”.`,
          link: '/admin/rewards',
          meta: {
            membershipId: String(membership._id),
            offerKey: key,
            offerTitle: offerLabel,
          },
        });
      }
    } catch {
      // Notification failure should not block the stamp
    }

    const card = formatCard(updated);
    return {
      card,
      offerKey: key,
      offerTitle: offerLabel,
      message:
        nextStatus === 'pending'
          ? `${offerLabel} complete! Waiting for the shop to verify your bills.`
          : `Stamp collected for ${offerLabel}`,
      pendingReview: nextStatus === 'pending',
    };
  }

  async requestStamp(userId, slug, { offerKey, offerTitle } = {}) {
    const tenant = await this.resolveActiveTenant(slug);
    if (readStampMode(tenant) !== LOYALTY_STAMP_MODES.REQUEST) {
      throw new AppError(
        'This shop requires a bill photo to collect stamps.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    let membership = await LoyaltyMembershipRepository.findByUserAndTenant(userId, tenant._id);
    if (!membership) {
      throw new AppError('Join this shop before requesting a stamp', HTTP_STATUS.NOT_FOUND);
    }
    this.assertMembershipActive(membership);
    membership = await this.syncMembershipCatalog(
      membership,
      readCatalog(await TenantRepository.findById(tenant._id))
    );

    const offers = ensureOffers(membership);
    const key = resolveOfferKey({ offerKey, offerTitle, offers });
    const offerIndex = offers.findIndex((o) => o.key === key);
    if (offerIndex < 0) {
      throw new AppError('Offer not found', HTTP_STATUS.NOT_FOUND);
    }

    const { catalog } = await this.getCatalogForTenant(tenant);
    const catalogOffer = catalog.find((o) => o.key === key);
    if (!catalogOffer || catalogOffer.status === 'paused' || !isOfferCurrentlyValid(catalogOffer)) {
      throw new AppError('This offer is not available right now', HTTP_STATUS.BAD_REQUEST);
    }

    const offer = offers[offerIndex];
    if (['pending', 'verified'].includes(offer.rewardStatus)) {
      throw new AppError(
        'This offer is waiting for the shop. New stamp requests are paused.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    if ((offer.stamps || 0) >= offer.stampsRequired) {
      throw new AppError('This offer is already complete', HTTP_STATUS.BAD_REQUEST);
    }
    if (hasPendingStampRequest(membership, key)) {
      throw new AppError('You already have a pending stamp request for this offer', HTTP_STATUS.BAD_REQUEST);
    }

    const offerLabel = String(offerTitle || offer.title || '').trim().slice(0, 200);
    const stampRequests = [
      ...(membership.stampRequests || []),
      {
        offerKey: key,
        offerTitle: offerLabel,
        status: 'pending',
        requestedAt: new Date(),
        resolvedAt: null,
      },
    ];

    const updated = await LoyaltyMembershipRepository.updateById(membership._id, { stampRequests });

    try {
      const tenantDoc = await TenantRepository.findById(tenant._id);
      const ownerId = tenantDoc?.owner?._id || tenantDoc?.owner;
      const customerLabel = customerName(updated.user || membership.user);
      if (ownerId) {
        await NotificationService.notifyUser({
          userId: ownerId,
          type: 'stamp_request',
          title: 'New stamp request',
          message: `${customerLabel} requested a stamp for “${offerLabel}”.`,
          link: '/admin/rewards',
          meta: {
            membershipId: String(membership._id),
            offerKey: key,
            offerTitle: offerLabel,
          },
        });
      }
    } catch {
      // Notification failure should not block the stamp request
    }

    return {
      card: formatCard(updated, catalog),
      offerKey: key,
      offerTitle: offerLabel,
      message: 'Stamp request sent. Waiting for the shop to approve.',
      pendingApproval: true,
    };
  }

  parseStampRequestId(rawId) {
    const value = String(rawId || '');
    const sep = value.indexOf(':');
    if (sep <= 0) throw new AppError('Invalid stamp request id', HTTP_STATUS.BAD_REQUEST);
    return {
      membershipId: value.slice(0, sep),
      requestId: value.slice(sep + 1),
    };
  }

  formatStampRequestRow(membership, request) {
    const user = membership.user || {};
    const offers = ensureOffers(membership);
    const offer = offers.find((o) => o.key === request.offerKey);
    const stamps = offer?.stamps || 0;
    const stampsRequired = offer?.stampsRequired || 5;
    return {
      id: `${membership._id}:${request._id}`,
      membershipId: String(membership._id),
      requestId: String(request._id),
      name: customerName(user),
      email: user.email || '',
      phone: user.phone || '',
      avatar: user.avatar || null,
      offer: request.offerTitle || offer?.title || 'Offer',
      reward: request.offerTitle || offer?.title || 'Offer',
      offerKey: request.offerKey,
      stamps,
      stampsRequired,
      progressAfterApprove: `${Math.min(stamps + 1, stampsRequired)} of ${stampsRequired}`,
      requestedAt: request.requestedAt,
      status: request.status,
    };
  }

  async listAdminStampRequests(adminUser) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const rows = await LoyaltyMembershipRepository.findWithPendingStampRequests(tenantId);
    const out = [];
    rows.forEach((membership) => {
      (membership.stampRequests || [])
        .filter((r) => r.status === 'pending')
        .forEach((request) => out.push(this.formatStampRequestRow(membership, request)));
    });
    out.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
    return out;
  }

  async listAdminRecentBillStamps(adminUser) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const rows = await LoyaltyMembershipRepository.findRecentBillStamps(tenantId, {
      sinceHours: 24,
      limit: 40,
    });
    return rows.map((row) => ({
      id: String(row.id),
      membershipId: String(row.membershipId || ''),
      name: customerName(row),
      offerTitle: String(row.offerTitle || 'Offer').trim() || 'Offer',
      offerKey: row.offerKey || '',
      stampedAt: row.stampedAt,
    }));
  }

  async approveStampRequest(adminUser, rawId) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const { membershipId, requestId } = this.parseStampRequestId(rawId);
    let membership = await LoyaltyMembershipRepository.findById(membershipId);
    if (!membership) throw new AppError('Stamp request not found', HTTP_STATUS.NOT_FOUND);
    if (String(membership.tenant._id || membership.tenant) !== String(tenantId)) {
      throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
    }

    membership = await this.persistOffersIfNeeded(membership);
    const request = (membership.stampRequests || []).find(
      (r) => String(r._id) === String(requestId) && r.status === 'pending'
    );
    if (!request) throw new AppError('Stamp request not found or already handled', HTTP_STATUS.NOT_FOUND);

    const offers = ensureOffers(membership);
    const offerIndex = offers.findIndex((o) => o.key === request.offerKey);
    if (offerIndex < 0) throw new AppError('Offer not found', HTTP_STATUS.NOT_FOUND);

    const offer = offers[offerIndex];
    if ((offer.stamps || 0) >= offer.stampsRequired) {
      throw new AppError('This offer is already complete', HTTP_STATUS.BAD_REQUEST);
    }

    const nextStamps = (offer.stamps || 0) + 1;
    const nextStatus = nextStamps >= offer.stampsRequired ? 'pending' : 'collecting';
    offers[offerIndex] = { ...offer, stamps: nextStamps, rewardStatus: nextStatus };

    const stampRequests = (membership.stampRequests || []).map((r) =>
      String(r._id) === String(requestId)
        ? { ...r.toObject?.() || r, status: 'approved', resolvedAt: new Date() }
        : r
    );

    const offerLabel = request.offerTitle || offer.title;
    const updated = await LoyaltyMembershipRepository.updateById(membership._id, {
      offers,
      stampRequests,
      stamps: offers[0]?.stamps || 0,
      rewardStatus: offers[0]?.rewardStatus || 'collecting',
      lastStampAt: new Date(),
      lastOfferKey: request.offerKey,
      lastOfferTitle: offerLabel,
    });

    const { catalog } = await this.getCatalogForTenant(tenantId);
    return {
      request: this.formatStampRequestRow({ ...updated.toObject(), user: membership.user }, {
        ...request.toObject?.() || request,
        status: 'approved',
        resolvedAt: new Date(),
      }),
      card: formatCard(updated, catalog),
      message:
        nextStatus === 'pending'
          ? `${offerLabel} complete! Customer can collect their reward after you confirm.`
          : `Stamp approved for ${offerLabel}`,
    };
  }

  async rejectStampRequest(adminUser, rawId) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const { membershipId, requestId } = this.parseStampRequestId(rawId);
    const membership = await LoyaltyMembershipRepository.findById(membershipId);
    if (!membership) throw new AppError('Stamp request not found', HTTP_STATUS.NOT_FOUND);
    if (String(membership.tenant._id || membership.tenant) !== String(tenantId)) {
      throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
    }

    const request = (membership.stampRequests || []).find(
      (r) => String(r._id) === String(requestId) && r.status === 'pending'
    );
    if (!request) throw new AppError('Stamp request not found or already handled', HTTP_STATUS.NOT_FOUND);

    const stampRequests = (membership.stampRequests || []).map((r) =>
      String(r._id) === String(requestId)
        ? { ...r.toObject?.() || r, status: 'rejected', resolvedAt: new Date() }
        : r
    );

    await LoyaltyMembershipRepository.updateById(membership._id, { stampRequests });

    return {
      request: this.formatStampRequestRow(membership, {
        ...request.toObject?.() || request,
        status: 'rejected',
        resolvedAt: new Date(),
      }),
      message: 'Stamp request rejected',
    };
  }

  async getAdminSettings(adminUser) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const tenant = await TenantRepository.findById(tenantId);
    if (!tenant) throw new AppError('Shop not found', HTTP_STATUS.NOT_FOUND);
    return {
      loyaltyStampMode: readStampMode(tenant),
      shopName: tenant.name,
      socialLinks: readSocialLinks(tenant),
    };
  }

  async updateAdminSettings(adminUser, { loyaltyStampMode, socialLinks } = {}) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const { LOYALTY_STAMP_MODE_VALUES } = require('@constants');
    const patch = {};

    if (loyaltyStampMode !== undefined) {
      if (!LOYALTY_STAMP_MODE_VALUES.includes(loyaltyStampMode)) {
        throw new AppError('Invalid loyalty stamp mode', HTTP_STATUS.BAD_REQUEST);
      }
      patch.loyaltyStampMode = loyaltyStampMode;
    }

    if (socialLinks !== undefined) {
      if (!socialLinks || typeof socialLinks !== 'object' || Array.isArray(socialLinks)) {
        throw new AppError('Invalid social links', HTTP_STATUS.BAD_REQUEST);
      }
      patch.socialLinks = normalizeSocialLinks(socialLinks);
    }

    if (!Object.keys(patch).length) {
      throw new AppError('Nothing to update', HTTP_STATUS.BAD_REQUEST);
    }

    const tenant = await TenantRepository.updateById(tenantId, patch);
    return {
      loyaltyStampMode: readStampMode(tenant),
      shopName: tenant.name,
      socialLinks: readSocialLinks(tenant),
    };
  }

  async redeemReward(userId, slug, { offerKey } = {}) {
    const tenant = await this.resolveActiveTenant(slug);
    let membership = await LoyaltyMembershipRepository.findByUserAndTenant(userId, tenant._id);
    if (!membership) {
      throw new AppError('You have not joined this shop yet', HTTP_STATUS.NOT_FOUND);
    }
    this.assertMembershipActive(membership);
    membership = await this.persistOffersIfNeeded(membership);

    const offers = ensureOffers(membership);
    const key = resolveOfferKey({ offerKey, offers });
    const idx = offers.findIndex((o) => o.key === key);
    if (idx < 0) throw new AppError('Offer not found', HTTP_STATUS.NOT_FOUND);

    const offer = offers[idx];
    if ((offer.stamps || 0) < offer.stampsRequired) {
      throw new AppError('Not enough stamps to redeem this offer', HTTP_STATUS.BAD_REQUEST);
    }
    if (offer.rewardStatus === 'redeemed') {
      throw new AppError('Reward already redeemed', HTTP_STATUS.BAD_REQUEST);
    }
    if (offer.rewardStatus === 'verified') {
      return {
        card: formatCard(membership),
        message: 'Your bills are verified. Show this at the shop to collect your reward.',
      };
    }

    offers[idx] = { ...offer, rewardStatus: 'pending' };
    const updated = await LoyaltyMembershipRepository.updateById(membership._id, {
      offers,
      rewardStatus: offers[0]?.rewardStatus || 'collecting',
    });

    return {
      card: formatCard(updated),
      message: 'Sent to the shop for bill verification.',
    };
  }

  async listAdminCustomers(adminUser) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const rows = await LoyaltyMembershipRepository.findByTenantForAdmin(tenantId);
    return rows.map((membership) => {
      const user = membership.user || {};
      const offers = ensureOffers(membership);
      const totalStamps = offers.reduce((sum, o) => sum + (o.stamps || 0), 0);
      const stampsRequired = offers.reduce((sum, o) => sum + (o.stampsRequired || 0), 0);
      return {
        id: String(membership._id),
        name: customerName(user),
        email: user.email || '',
        phone: user.phone || '',
        avatar: user.avatar || null,
        joinedAt: membership.joinedAt,
        lastStampAt: membership.lastStampAt,
        totalStamps,
        stampsRequired,
        offerCount: offers.length,
        status: membership.status === 'inactive' ? 'suspended' : 'active',
      };
    });
  }

  async getAdminCustomerDetail(adminUser, membershipId) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const membership = await LoyaltyMembershipRepository.findByIdWithBills(membershipId);
    if (!membership) {
      throw new AppError('Customer not found', HTTP_STATUS.NOT_FOUND);
    }
    if (String(membership.tenant?._id || membership.tenant) !== String(tenantId)) {
      throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
    }

    const user = membership.user || {};
    const offers = ensureOffers(membership);
    const totalStamps = offers.reduce((sum, o) => sum + (o.stamps || 0), 0);
    const stampsRequired = offers.reduce((sum, o) => sum + (o.stampsRequired || 0), 0);

    const events = [];
    (membership.bills || []).forEach((bill) => {
      if (!bill?.stampedAt) return;
      events.push({
        at: bill.stampedAt,
        offerTitle: bill.offerTitle || 'Stamp',
        source: 'bill',
      });
    });
    (membership.stampRequests || []).forEach((request) => {
      if (request.status !== 'approved') return;
      const at = request.resolvedAt || request.requestedAt;
      if (!at) return;
      events.push({
        at,
        offerTitle: request.offerTitle || 'Stamp',
        source: 'request',
      });
    });
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const scanHistory = events.map((event, index) => ({
      index: index + 1,
      at: event.at,
      offerTitle: event.offerTitle,
      source: event.source,
    }));

    const lastVisit =
      scanHistory.length > 0
        ? scanHistory[scanHistory.length - 1].at
        : membership.lastStampAt || membership.joinedAt || null;

    return {
      id: String(membership._id),
      name: customerName(user),
      email: user.email || '',
      phone: user.phone || '',
      avatar: user.avatar || null,
      joinedAt: membership.joinedAt,
      lastStampAt: membership.lastStampAt,
      totalStamps,
      stampsRequired,
      offerCount: offers.length,
      status: membership.status === 'inactive' ? 'suspended' : 'active',
      totalVisits: scanHistory.length,
      lastVisit,
      scanHistory,
      offers: offers.map((offer) => ({
        key: offer.key,
        title: offer.title,
        stamps: offer.stamps || 0,
        stampsRequired: offer.stampsRequired || 0,
        rewardStatus: offer.rewardStatus || 'collecting',
      })),
    };
  }

  async updateAdminCustomerStatus(adminUser, membershipId, status) {
    const next = status === 'suspended' ? 'inactive' : 'active';
    if (!['active', 'suspended'].includes(status)) {
      throw new AppError('Invalid customer status', HTTP_STATUS.BAD_REQUEST);
    }
    await this.getAdminMembership(adminUser, membershipId);
    const updated = await LoyaltyMembershipRepository.updateById(membershipId, { status: next });
    const user = updated.user || {};
    const offers = ensureOffers(updated);
    return {
      id: String(updated._id),
      name: customerName(user),
      email: user.email || '',
      phone: user.phone || '',
      joinedAt: updated.joinedAt,
      lastStampAt: updated.lastStampAt,
      totalStamps: offers.reduce((sum, o) => sum + (o.stamps || 0), 0),
      offerCount: offers.length,
      status: updated.status === 'inactive' ? 'suspended' : 'active',
    };
  }

  async deleteAdminCustomer(adminUser, membershipId) {
    await this.getAdminMembership(adminUser, membershipId);
    await LoyaltyMembershipRepository.deleteById(membershipId);
    return { deleted: true };
  }

  async getAdminDashboardStats(adminUser) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const { catalog } = await this.getCatalogForTenant(tenantId);
    const rows = await LoyaltyMembershipRepository.findByTenant(tenantId);
    let pendingRewards = 0;
    let redeemedRewards = 0;
    let pendingStampRequests = 0;
    rows.forEach((membership) => {
      pendingStampRequests += (membership.stampRequests || []).filter((r) => r.status === 'pending').length;
      ensureOffers(membership).forEach((o) => {
        if (o.rewardStatus === 'pending' || o.rewardStatus === 'verified') pendingRewards += 1;
        if (o.rewardStatus === 'redeemed') redeemedRewards += 1;
      });
    });
    const tenant = await TenantRepository.findById(tenantId);
    const qrScans = await this.getLoyaltyQrScanStats(tenantId);
    return {
      totalCustomers: rows.length,
      pendingRewards,
      pendingStampRequests,
      redeemedRewards,
      activeCampaigns: catalog.filter((o) => o.status === 'active').length,
      loyaltyStampMode: readStampMode(tenant),
      qrScans,
    };
  }

  async listAdminOffers(adminUser) {
    const tenantId = await this.getAdminTenantId(adminUser);
    let { catalog } = await this.getCatalogForTenant(tenantId);
    const rows = await LoyaltyMembershipRepository.findByTenant(tenantId);

    const redemptionCounts = {};
    rows.forEach((membership) => {
      ensureOffers(membership).forEach((o) => {
        if (o.rewardStatus === 'redeemed') {
          redemptionCounts[o.key] = (redemptionCounts[o.key] || 0) + 1;
        }
      });
    });

    const customerCounts = buildEnrolledCounts(rows);
    catalog = await this.pauseOffersAtCapacity(tenantId, catalog, customerCounts);

    return catalog.map((o) =>
      formatAdminOffer(o, {
        redemptions: redemptionCounts[o.key] || 0,
        customerCount: customerCounts[o.key] || 0,
      })
    );
  }

  async createAdminOffer(
    adminUser,
    { title, stampsRequired, color, startDate, validUntil, minOrderValue, maxCustomers } = {}
  ) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const { tenant, catalog } = await this.getCatalogForTenant(tenantId);

    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) throw new AppError('Offer title is required', HTTP_STATUS.BAD_REQUEST);
    const stamps = Math.min(100, Math.max(1, Number(stampsRequired) || 5));
    const schedule = validateOfferSchedule(startDate, validUntil);

    let key = slugifyOfferKey(cleanTitle);
    const existingKeys = new Set(catalog.map((o) => o.key));
    if (existingKeys.has(key)) {
      let n = 2;
      while (existingKeys.has(`${key}_${n}`)) n += 1;
      key = `${key}_${n}`;
    }

    const offer = normalizeCatalogOffer({
      key,
      title: cleanTitle.slice(0, 200),
      stampsRequired: stamps,
      status: 'active',
      color: color || OFFER_COLORS[catalog.length % OFFER_COLORS.length],
      createdAt: new Date(),
      startDate: schedule.startDate,
      validUntil: schedule.validUntil,
      minOrderValue: Math.max(0, Number(minOrderValue) || 0),
      maxCustomers: normalizeMaxCustomers(maxCustomers),
    });

    const loyaltyOffers = [...catalog, offer];
    await TenantRepository.updateById(tenant._id, { loyaltyOffers });
    await this.pushOfferToMembers(tenant._id, offer);

    const rows = await LoyaltyMembershipRepository.findByTenant(tenant._id);
    const customerCounts = buildEnrolledCounts(rows);
    const refreshed = await this.getCatalogForTenant(tenant._id);
    const saved = refreshed.catalog.find((o) => o.key === offer.key) || offer;

    return formatAdminOffer(saved, {
      redemptions: 0,
      customerCount: customerCounts[offer.key] || 0,
    });
  }

  async updateAdminOffer(
    adminUser,
    offerKey,
    { title, stampsRequired, status, color, startDate, validUntil, minOrderValue, maxCustomers } = {}
  ) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const { tenant, catalog } = await this.getCatalogForTenant(tenantId);
    const idx = catalog.findIndex((o) => o.key === offerKey);
    if (idx < 0) throw new AppError('Offer not found', HTTP_STATUS.NOT_FOUND);

    const next = { ...catalog[idx] };
    if (title !== undefined) {
      const cleanTitle = String(title || '').trim();
      if (!cleanTitle) throw new AppError('Offer title is required', HTTP_STATUS.BAD_REQUEST);
      next.title = cleanTitle.slice(0, 200);
    }
    if (stampsRequired !== undefined) {
      next.stampsRequired = Math.min(100, Math.max(1, Number(stampsRequired) || 5));
    }
    if (status !== undefined) {
      if (!['active', 'paused'].includes(status)) {
        throw new AppError('Invalid offer status', HTTP_STATUS.BAD_REQUEST);
      }
      next.status = status;
    }
    if (color !== undefined && color) next.color = String(color).slice(0, 40);
    if (startDate !== undefined || validUntil !== undefined) {
      const schedule = validateOfferSchedule(
        startDate !== undefined ? startDate : next.startDate,
        validUntil !== undefined ? validUntil : next.validUntil
      );
      next.startDate = schedule.startDate;
      next.validUntil = schedule.validUntil;
    }
    if (minOrderValue !== undefined) {
      next.minOrderValue = Math.max(0, Number(minOrderValue) || 0);
    }
    if (maxCustomers !== undefined) {
      next.maxCustomers = normalizeMaxCustomers(maxCustomers);
    }

    const rowsBefore = await LoyaltyMembershipRepository.findByTenant(tenant._id);
    const enrolledBefore = buildEnrolledCounts(rowsBefore);
    const currentCount = enrolledBefore[offerKey] || 0;

    if (status === 'active' && isOfferAtCapacity(next, currentCount)) {
      throw new AppError(
        'Customer limit reached. Increase number of customers before activating this offer.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Limit already filled (e.g. maxCustomers lowered) → auto-pause
    if (next.status === 'active' && isOfferAtCapacity(next, currentCount)) {
      next.status = 'paused';
    }

    const loyaltyOffers = catalog.map((o, i) => (i === idx ? next : o));
    await TenantRepository.updateById(tenant._id, { loyaltyOffers });

    const enrolledCounts = { ...enrolledBefore };
    const rows = rowsBefore;
    await Promise.all(
      rows.map(async (membership) => {
        const offers = ensureOffers(membership);
        const oi = offers.findIndex((o) => o.key === offerKey);
        if (oi < 0) {
          if (
            next.status === 'active' &&
            isOfferCurrentlyValid(next) &&
            !isOfferAtCapacity(next, enrolledCounts[offerKey] || 0)
          ) {
            offers.push({
              key: next.key,
              title: next.title,
              stamps: 0,
              stampsRequired: next.stampsRequired,
              rewardStatus: 'collecting',
              verifiedAt: null,
              redeemedAt: null,
            });
            enrolledCounts[offerKey] = (enrolledCounts[offerKey] || 0) + 1;
            await LoyaltyMembershipRepository.updateById(membership._id, { offers });
          }
          return;
        }
        offers[oi] = {
          ...offers[oi],
          title: next.title,
          stampsRequired: next.stampsRequired,
          stamps: Math.min(offers[oi].stamps || 0, next.stampsRequired),
        };
        await LoyaltyMembershipRepository.updateById(membership._id, { offers });
      })
    );

    let catalogAfter = catalog.map((o, i) => (i === idx ? next : o));
    catalogAfter = await this.pauseOffersAtCapacity(tenant._id, catalogAfter, enrolledCounts);
    const saved = catalogAfter.find((o) => o.key === offerKey) || next;

    let redemptions = 0;
    rows.forEach((m) => {
      ensureOffers(m).forEach((o) => {
        if (o.key === offerKey && o.rewardStatus === 'redeemed') redemptions += 1;
      });
    });

    return formatAdminOffer(saved, {
      redemptions,
      customerCount: enrolledCounts[offerKey] || countEnrolledCustomers(rows, offerKey),
    });
  }

  async listAdminRewards(adminUser, { filter = 'pending' } = {}) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const { catalog } = await this.getCatalogForTenant(tenantId);
    const catalogKeys = new Set(catalog.map((o) => o.key));
    const statuses =
      filter === 'redeemed'
        ? ['redeemed']
        : filter === 'pending'
          ? ['pending', 'verified']
          : ['pending', 'verified', 'redeemed'];

    const rows = await LoyaltyMembershipRepository.findByTenant(tenantId);
    const out = [];
    for (const membership of rows) {
      const cleaned = await this.scrubLegacyMembership(membership);
      const offers = ensureOffers(cleaned);
      offers
        .filter(
          (o) =>
            catalogKeys.has(o.key) &&
            statuses.includes(o.rewardStatus || 'collecting')
        )
        .forEach((offer) => out.push(formatAdminOfferRow(cleaned, offer)));
    }
    return out;
  }

  parseRewardId(rawId) {
    const value = String(rawId || '');
    const [membershipId, offerKey] = value.includes(':') ? value.split(':') : [value, 'free_reward'];
    return { membershipId, offerKey: offerKey || 'free_reward' };
  }

  async getAdminRewardDetail(adminUser, rewardId) {
    const tenantId = await this.getAdminTenantId(adminUser);
    const { membershipId, offerKey } = this.parseRewardId(rewardId);
    const membership = await LoyaltyMembershipRepository.findByIdWithBills(membershipId);
    if (!membership) {
      throw new AppError('Reward request not found', HTTP_STATUS.NOT_FOUND);
    }
    if (String(membership.tenant._id || membership.tenant) !== String(tenantId)) {
      throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
    }
    const offers = ensureOffers(membership);
    const offer = offers.find((o) => o.key === offerKey) || offers[0];
    if (!offer) throw new AppError('Offer not found', HTTP_STATUS.NOT_FOUND);
    return formatAdminOfferRow(membership, offer, {
      includeBills: true,
      bills: membership.bills || [],
    });
  }

  async verifyAdminReward(adminUser, rewardId) {
    const detail = await this.getAdminRewardDetail(adminUser, rewardId);
    if (detail.redeemed) {
      throw new AppError('Reward already given', HTTP_STATUS.BAD_REQUEST);
    }
    if (detail.rewardStatus !== 'pending' && detail.rewardStatus !== 'verified') {
      throw new AppError('This offer is not ready for verification', HTTP_STATUS.BAD_REQUEST);
    }

    const { membershipId, offerKey } = this.parseRewardId(rewardId);
    let membership = await LoyaltyMembershipRepository.findById(membershipId);
    membership = await this.persistOffersIfNeeded(membership);
    const offers = ensureOffers(membership).map((o) =>
      o.key === offerKey
        ? { ...o, rewardStatus: 'verified', verifiedAt: new Date() }
        : o
    );
    await LoyaltyMembershipRepository.updateById(membershipId, {
      offers,
      rewardStatus: offers[0]?.rewardStatus || 'collecting',
      verifiedAt: new Date(),
    });
    return this.getAdminRewardDetail(adminUser, rewardId);
  }

  async cancelAdminReward(adminUser, rewardId) {
    await this.getAdminRewardDetail(adminUser, rewardId);
    const { membershipId, offerKey } = this.parseRewardId(rewardId);
    let membership = await LoyaltyMembershipRepository.findByIdWithBills(membershipId);
    membership = await this.persistOffersIfNeeded(membership);

    const offers = ensureOffers(membership).map((o) =>
      o.key === offerKey
        ? {
            ...o,
            stamps: 0,
            rewardStatus: 'collecting',
            verifiedAt: null,
            redeemedAt: null,
          }
        : o
    );
    const remainingBills = (membership.bills || []).filter((b) => b.offerKey && b.offerKey !== offerKey);

    await LoyaltyMembershipRepository.updateById(membershipId, {
      offers,
      bills: remainingBills,
      billCount: remainingBills.length,
      stamps: offers[0]?.stamps || 0,
      rewardStatus: offers[0]?.rewardStatus || 'collecting',
      verifiedAt: null,
      lastOfferKey: '',
      lastOfferTitle: '',
      lastBillDocumentName: '',
    });

    return formatAdminOfferRow(
      { ...membership.toObject(), offers, user: membership.user },
      offers.find((o) => o.key === offerKey)
    );
  }

  async giveAdminReward(adminUser, rewardId) {
    const detail = await this.getAdminRewardDetail(adminUser, rewardId);
    if (detail.redeemed) {
      throw new AppError('Reward already given', HTTP_STATUS.BAD_REQUEST);
    }

    const tenantId = await this.getAdminTenantId(adminUser);
    const tenant = await TenantRepository.findById(tenantId);
    const isRequestMode = readStampMode(tenant) === LOYALTY_STAMP_MODES.REQUEST;
    const canGive =
      detail.rewardStatus === 'verified' ||
      (isRequestMode && detail.rewardStatus === 'pending');
    if (!canGive) {
      throw new AppError(
        isRequestMode
          ? 'This reward is not ready to give yet'
          : 'Verify the bills before giving the reward',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { membershipId, offerKey } = this.parseRewardId(rewardId);
    let membership = await LoyaltyMembershipRepository.findByIdWithBills(membershipId);
    membership = await this.persistOffersIfNeeded(membership);

    const offers = ensureOffers(membership).map((o) =>
      o.key === offerKey
        ? {
            ...o,
            stamps: 0,
            rewardStatus: 'redeemed',
            redeemedAt: new Date(),
          }
        : o
    );
    const remainingBills = (membership.bills || []).filter((b) => b.offerKey && b.offerKey !== offerKey);

    await LoyaltyMembershipRepository.updateById(membershipId, {
      offers,
      bills: remainingBills,
      billCount: remainingBills.length,
      stamps: offers[0]?.stamps || 0,
      rewardStatus: offers[0]?.rewardStatus || 'collecting',
      redeemedAt: new Date(),
      lastBillDocumentName: '',
    });

    return formatAdminOfferRow(
      { ...membership.toObject(), offers, user: membership.user },
      offers.find((o) => o.key === offerKey)
    );
  }
}

module.exports = new LoyaltyService();
