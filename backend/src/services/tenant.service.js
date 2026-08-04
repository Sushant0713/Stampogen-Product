const AppError = require('@utils/AppError');
const { HTTP_STATUS, TENANT_STATUS, SHOP_CATEGORIES, SHOP_CATEGORY_VALUES, LOYALTY_STAMP_MODES, LOYALTY_STAMP_MODE_VALUES } = require('@constants');
const { ROLES } = require('@constants/roles');
const { slugify } = require('@helpers');
const crypto = require('crypto');
const config = require('@config');
const TenantRepository = require('@repositories/tenant.repository');
const UserRepository = require('@repositories/user.repository');
const RoleRepository = require('@repositories/role.repository');
const PlanRepository = require('@repositories/plan.repository');
const OAuthRepository = require('@repositories/oauth.repository');
const RefreshTokenRepository = require('@repositories/refreshToken.repository');
const EmailOtpRepository = require('@repositories/emailOtp.repository');
const PlatformInvoiceService = require('@services/platformInvoice.service');
const PaymentRepository = require('@repositories/payment.repository');
const { normalizeBillingProfile } = require('@helpers/billingProfile.helper');
const { evaluateDiscount } = require('@helpers/discount.helper');
const DiscountRepository = require('@repositories/discount.repository');
const { sendAdminClientCredentialsEmail, sendFreeTrialStartedEmail } = require('@services/email.service');
const {
  PLAN_RATES,
  buildSegment,
  ensureBillingLedger,
  applyPlanChange,
  summarizeBilling,
  applyTrialPlan,
  extendTrialOrPlan,
  markSubscriptionManual,
  calendarDaysRemaining,
  getEffectiveEndsAt,
} = require('@helpers/billing.helper');

const REPAIR_COOLDOWN_MS = 5 * 60 * 1000;
let lastOrphanRepairAt = 0;

function ownerEmailFromTenant(tenant) {
  const owner = tenant?.owner;
  return String(owner?.email || '').trim().toLowerCase();
}

function mergePaymentBilling(billing, paymentSummary) {
  const next = { ...(billing || {}) };
  if (!paymentSummary) {
    next.discountCode = next.discountCode || '';
    next.discountCodes = next.discountCodes || [];
    next.paidRevenue = next.paidRevenue ?? null;
    return next;
  }

  // Revenue = plan amount after discount, excluding GST
  next.revenue = Number(paymentSummary.revenue) || 0;
  next.paidRevenue = next.revenue;
  next.listTotal = Number(paymentSummary.listTotal) || 0;
  next.discountTotal = Number(paymentSummary.discountTotal) || 0;
  next.discountCode = paymentSummary.discountCode || '';
  next.discountCodes = paymentSummary.discountCodes || [];
  next.paymentCount = paymentSummary.paymentCount || 0;

  if (paymentSummary.latestPayableAmount != null) {
    next.pricePerCycle = Number(paymentSummary.latestPayableAmount) || next.pricePerCycle || 0;
  }
  if (paymentSummary.latestListAmount != null) {
    next.listAmount = Number(paymentSummary.latestListAmount) || 0;
  }
  if (paymentSummary.latestDiscountAmount != null) {
    next.discountAmount = Number(paymentSummary.latestDiscountAmount) || 0;
  }

  return next;
}

class TenantService {
  withBilling(tenantDoc) {
    const { tenant, billing, needsPersist } = ensureBillingLedger(tenantDoc);
    return { tenant, billing, needsPersist };
  }

  async persistBillingIfNeeded(id, tenant, needsPersist) {
    if (!needsPersist) return tenant;
    return TenantRepository.updateById(id, {
      currentPlan: tenant.currentPlan,
      billingHistory: tenant.billingHistory,
    });
  }

  async uniqueSlug(baseName) {
    let base = slugify(baseName) || 'shop';
    let slug = base;
    let attempt = 0;
    while (await TenantRepository.findBySlug(slug)) {
      attempt += 1;
      slug = `${base}-${attempt}`;
    }
    return slug;
  }

  /**
   * Recreate tenant docs for verified admins whose tenant was deleted / never persisted.
   */
  async repairOrphanedAdminTenants() {
    const orphans = await TenantRepository.findOrphansNeedingRepair();
    let repaired = 0;

    for (const { admin, staleTenantId } of orphans) {
      const orgName =
        [admin.firstName, admin.lastName].filter(Boolean).join(' ').trim() ||
        admin.email?.split('@')[0] ||
        'Shop';
      const tenantName = `${orgName}'s Shop`;
      const slug = await this.uniqueSlug(tenantName);

      const payload = {
        name: tenantName,
        slug,
        owner: admin._id,
        status: admin.isActive ? TENANT_STATUS.ACTIVE : TENANT_STATUS.PENDING,
        currentPlan: {
          name: null,
          pricePerCycle: 0,
          startedAt: null,
        },
        billingHistory: [],
      };

      if (staleTenantId) {
        payload._id = staleTenantId;
      }

      try {
        const tenant = await TenantRepository.create(payload);
        const tenantId = tenant._id || staleTenantId;
        if (!admin.tenant || String(admin.tenant) !== String(tenantId)) {
          await UserRepository.updateById(admin._id, { tenant: tenantId });
        }
        repaired += 1;
      } catch (error) {
        if (staleTenantId) {
          delete payload._id;
          const tenant = await TenantRepository.create(payload);
          await UserRepository.updateById(admin._id, { tenant: tenant._id });
          repaired += 1;
        } else {
          console.warn('Failed to repair tenant for', admin.email, error.message);
        }
      }
    }

    return repaired;
  }

  async repairOrphanedAdminTenantsThrottled() {
    const now = Date.now();
    if (now - lastOrphanRepairAt < REPAIR_COOLDOWN_MS) {
      return 0;
    }
    lastOrphanRepairAt = now;
    return this.repairOrphanedAdminTenants();
  }

  async ensureTenantForAdmin(user, { tenantName } = {}) {
    if (!user) return null;

    const existingId = user.tenant?._id || user.tenant || null;
    if (existingId) {
      const exists = await TenantRepository.existsById(existingId);
      if (exists) {
        return TenantRepository.findById(existingId);
      }
    }

    const orgName =
      tenantName ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email?.split('@')[0] ||
      'Shop';
    const name = tenantName || `${orgName}'s Shop`;
    const slug = await this.uniqueSlug(name);

    const payload = {
      name,
      slug,
      owner: user._id,
      status: user.isEmailVerified ? TENANT_STATUS.ACTIVE : TENANT_STATUS.PENDING,
    };
    if (existingId) payload._id = existingId;

    let tenant;
    try {
      tenant = await TenantRepository.create(payload);
    } catch {
      delete payload._id;
      tenant = await TenantRepository.create(payload);
    }

    await UserRepository.updateById(user._id, { tenant: tenant._id });
    return tenant;
  }

  async create({ name, slug, ownerId, planName = 'Starter' }) {
    const tenantSlug = slug || (await this.uniqueSlug(name));
    const existing = await TenantRepository.findBySlug(tenantSlug);

    if (existing) {
      throw new AppError('Tenant slug already exists', HTTP_STATUS.CONFLICT);
    }

    const startDate = new Date();
    const pricePerCycle = PLAN_RATES[planName] || PLAN_RATES.Starter;
    const resolvedPlan = PLAN_RATES[planName] ? planName : 'Starter';

    const tenant = await TenantRepository.create({
      name,
      slug: tenantSlug,
      owner: ownerId,
      status: TENANT_STATUS.ACTIVE,
      currentPlan: {
        name: resolvedPlan,
        pricePerCycle,
        startedAt: startDate,
      },
      billingHistory: [
        buildSegment({
          planName: resolvedPlan,
          pricePerCycle,
          startDate,
          endDate: null,
        }),
      ],
    });

    await UserRepository.updateById(ownerId, { tenant: tenant._id });

    return {
      ...tenant.toObject(),
      billing: summarizeBilling(tenant),
    };
  }

  /**
   * Super Admin → Add Client: create shop owner (admin) + tenant in one step.
   * Issues a temporary password and emails login details when SMTP is configured.
   */
  async createClient(data = {}) {
    const firstName = String(data.firstName || '').trim();
    const middleName = String(data.middleName || '').trim();
    const lastName = String(data.lastName || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const phone = String(data.phone || '').trim();
    const tenantName = String(data.name || data.tenantName || '').trim();
    const category = String(data.category || '').trim();
    const customCategory = String(data.customCategory || '').trim().slice(0, 100);
    const loyaltyStampMode = LOYALTY_STAMP_MODE_VALUES.includes(data.loyaltyStampMode)
      ? data.loyaltyStampMode
      : LOYALTY_STAMP_MODES.BILL;

    if (!firstName || !lastName) {
      throw new AppError('First and last name are required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!email) {
      throw new AppError('Email is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (phone.length < 8) {
      throw new AppError('Valid phone number is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!tenantName || tenantName.length < 2) {
      throw new AppError('Company / shop name is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!SHOP_CATEGORY_VALUES.includes(category)) {
      throw new AppError('Shop category is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (category === SHOP_CATEGORIES.CUSTOM && customCategory.length < 2) {
      throw new AppError('Please enter your custom category', HTTP_STATUS.BAD_REQUEST);
    }

    const billingProfile = normalizeBillingProfile({
      phone,
      address: data.address,
      street: data.street,
      city: data.city,
      state: data.state,
      pin: data.pin,
      gstin: data.gstin,
      pan: data.pan,
      chargeGst: data.chargeGst,
    });

    if (!billingProfile.street && !billingProfile.address) {
      throw new AppError('Street address is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!billingProfile.state) {
      throw new AppError('State is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!billingProfile.city) {
      throw new AppError('City is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!/^\d{6}$/.test(billingProfile.pin || '')) {
      throw new AppError('Valid 6-digit PIN code is required', HTTP_STATUS.BAD_REQUEST);
    }

    const discountCode = String(data.discountCode || '')
      .trim()
      .toUpperCase();
    let reservedDiscountCode = '';
    if (discountCode) {
      const discount = await DiscountRepository.findByCode(discountCode);
      if (!discount) {
        throw new AppError('Invalid discount code', HTTP_STATUS.BAD_REQUEST);
      }

      let planForDiscount = null;
      if (data.planId) planForDiscount = await PlanRepository.findById(data.planId);
      if (!planForDiscount && data.planCode) {
        planForDiscount = await PlanRepository.findByCode(String(data.planCode).trim());
      }
      if (!planForDiscount && data.planName) {
        planForDiscount =
          (await PlanRepository.findByCode(String(data.planName).trim())) ||
          (await PlanRepository.findByName(String(data.planName).trim()));
      }

      const result = evaluateDiscount(discount, {
        orderAmount: Number(planForDiscount?.priceAmount) || 0,
        planName: planForDiscount?.name || '',
        billingCycle: planForDiscount?.billing || '',
      });
      if (!result.ok) {
        throw new AppError(result.reason || 'Discount cannot be applied', HTTP_STATUS.BAD_REQUEST);
      }
      reservedDiscountCode = result.code || discountCode;
    }

    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      throw new AppError('Email already registered', HTTP_STATUS.CONFLICT);
    }

    const role = await RoleRepository.findBySlug(ROLES.ADMIN);
    if (!role) {
      throw new AppError('Admin role not found. Please seed the database.', HTTP_STATUS.BAD_REQUEST);
    }

    const issuedPassword =
      String(data.password || '').trim() ||
      `Sp${crypto.randomBytes(4).toString('hex')}9a`;

    const user = await UserRepository.create({
      firstName,
      middleName,
      lastName,
      email,
      phone: billingProfile.phone || phone,
      password: issuedPassword,
      role: role._id,
      isEmailVerified: true,
      isActive: true,
    });

    const tenantSlug = data.slug
      ? String(data.slug).trim().toLowerCase()
      : await this.uniqueSlug(tenantName);

    if (await TenantRepository.findBySlug(tenantSlug)) {
      await UserRepository.deleteById(user._id);
      throw new AppError('Tenant slug already exists', HTTP_STATUS.CONFLICT);
    }

    let tenant;
    try {
      tenant = await TenantRepository.create({
        name: tenantName,
        slug: tenantSlug,
        owner: user._id,
        status: TENANT_STATUS.ACTIVE,
        billingProfile,
        loyaltyStampMode,
        category,
        customCategory: category === SHOP_CATEGORIES.CUSTOM ? customCategory : '',
        ...(reservedDiscountCode ? { reservedDiscountCode } : {}),
      });
    } catch (error) {
      await UserRepository.deleteById(user._id);
      throw new AppError(
        error.message || 'Unable to create client shop',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    await UserRepository.updateById(user._id, { tenant: tenant._id });

    let finalTenant = await this.getById(tenant._id);

    if (data.planId || data.planCode || data.planName) {
      try {
        finalTenant = await this.changePlan(tenant._id, {
          planId: data.planId,
          planCode: data.planCode,
          planName: data.planName,
        });
      } catch (error) {
        // Client is created; plan can be assigned later
        console.warn('[createClient] plan assign failed:', error.message || error);
      }
    }

    const loginUrl = `${String(config.frontendUrl || '').replace(/\/$/, '')}/admin/login`;
    try {
      await sendAdminClientCredentialsEmail({
        to: email,
        name: [firstName, lastName].filter(Boolean).join(' ') || firstName,
        email,
        password: issuedPassword,
        shopName: tenantName,
        loginUrl,
      });
    } catch (error) {
      console.error('[createClient] Failed to email credentials:', error.message || error);
    }

    return {
      tenant: finalTenant,
      owner: {
        _id: user._id,
        firstName,
        middleName,
        lastName,
        email,
        phone: billingProfile.phone || phone,
      },
      issuedPassword,
      loginUrl,
      reservedDiscountCode: reservedDiscountCode || '',
    };
  }

  async getById(id) {
    const tenant = await TenantRepository.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    const { tenant: withLedger, billing, needsPersist } = this.withBilling(tenant);
    const persisted = await this.persistBillingIfNeeded(id, withLedger, needsPersist);

    const email = ownerEmailFromTenant(persisted);
    const paymentMap = await PaymentRepository.summarizeByCustomerEmails(
      email ? [email] : []
    );
    const paymentSummary = email ? paymentMap.get(email) : null;

    return {
      ...(persisted.toObject ? persisted.toObject() : persisted),
      billing: mergePaymentBilling(billing, paymentSummary),
    };
  }

  async getAll(filter, options) {
    // Orphan repair is expensive — kick off in background, never block the list
    void this.repairOrphanedAdminTenantsThrottled().catch((error) => {
      console.warn('[tenants] orphan repair failed:', error.message);
    });

    const result = await TenantRepository.findAll(filter, options);

    const emails = result.tenants
      .map((item) => {
        const owner = item.owner;
        return String(owner?.email || '').trim().toLowerCase();
      })
      .filter(Boolean);
    const paymentMap = await PaymentRepository.summarizeByCustomerEmails(emails);

    const tenants = result.tenants.map((item) => {
      const { tenant, billing, needsPersist } = this.withBilling(item);
      // Persist billing fixes off the request path so list stays fast
      if (needsPersist) {
        void TenantRepository.updateById(item._id, {
          currentPlan: tenant.currentPlan,
          billingHistory: tenant.billingHistory,
        }).catch((error) => {
          console.warn('[tenants] billing persist failed:', error.message);
        });
      }

      const owner = item.owner;
      const ownerPlain =
        owner && typeof owner.toObject === 'function'
          ? owner.toObject({ virtuals: true })
          : owner;
      const email = String(ownerPlain?.email || '').trim().toLowerCase();
      const paymentSummary = email ? paymentMap.get(email) : null;

      return {
        ...tenant,
        owner: ownerPlain || tenant.owner || null,
        billing: mergePaymentBilling(billing, paymentSummary),
      };
    });

    return {
      tenants,
      pagination: result.pagination,
    };
  }

  async getStats() {
    void this.repairOrphanedAdminTenantsThrottled().catch((error) => {
      console.warn('[tenants] orphan repair failed:', error.message);
    });
    return TenantRepository.getStats();
  }

  async update(id, data) {
    const previous = await TenantRepository.findById(id);
    if (!previous) {
      throw new AppError('Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    const tenant = await TenantRepository.updateById(id, data);
    if (!tenant) {
      throw new AppError('Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    // Kick active sessions when a client is suspended
    if (
      data.status === TENANT_STATUS.SUSPENDED &&
      previous.status !== TENANT_STATUS.SUSPENDED
    ) {
      const ownerId = tenant.owner?._id || tenant.owner || previous.owner?._id || previous.owner;
      if (ownerId) {
        await RefreshTokenRepository.deleteByUser(ownerId);
      }
    }

    const { tenant: withLedger, billing, needsPersist } = this.withBilling(tenant);
    const persisted = await this.persistBillingIfNeeded(id, withLedger, needsPersist);

    return {
      ...(persisted.toObject ? persisted.toObject() : persisted),
      billing,
    };
  }

  async changePlan(id, planRef) {
    const planId = planRef?.planId || planRef?.id || null;
    const planCode = String(planRef?.planCode || '').trim();
    const planNameInput = String(planRef?.planName || planRef || '').trim();

    let plan = null;
    if (planId) {
      plan = await PlanRepository.findById(planId);
    }
    if (!plan && planCode) {
      plan = await PlanRepository.findByCode(planCode);
    }
    if (!plan && planNameInput) {
      plan = (await PlanRepository.findByCode(planNameInput)) || (await PlanRepository.findByName(planNameInput));
    }

    if (!plan) {
      throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND);
    }
    if (plan.status === 'Inactive' || plan.enabled === false) {
      throw new AppError('This plan is inactive', HTTP_STATUS.BAD_REQUEST);
    }
    if (plan.priceCustom) {
      throw new AppError('Custom / contact-sales plans cannot be assigned here', HTTP_STATUS.BAD_REQUEST);
    }

    const planName = plan.name;
    const pricePerCycle = Number(plan.priceAmount) || 0;

    const tenant = await TenantRepository.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    const ensured = ensureBillingLedger(tenant);
    if (ensured.needsPersist) {
      await TenantRepository.updateById(id, {
        currentPlan: ensured.tenant.currentPlan,
        billingHistory: ensured.tenant.billingHistory,
      });
    }

    const base = ensured.needsPersist
      ? await TenantRepository.findById(id)
      : tenant;

    if (
      base.currentPlan?.name &&
      String(base.currentPlan.name).toLowerCase() === String(planName).toLowerCase()
    ) {
      throw new AppError('Client is already on this plan', HTTP_STATUS.BAD_REQUEST);
    }

    const { tenant: updated, billing } = applyPlanChange(
      base,
      planName,
      new Date(),
      pricePerCycle,
      plan.billing || 'Monthly'
    );
    const manual = markSubscriptionManual(updated);
    const saved = await TenantRepository.updateById(id, {
      currentPlan: manual.currentPlan,
      pendingPlan: manual.pendingPlan,
      billingHistory: manual.billingHistory,
      subscriptionSource: manual.subscriptionSource,
      trial: manual.trial,
    });

    let invoice = null;
    try {
      invoice = await PlatformInvoiceService.issueForPlanChange({
        tenant: saved.toObject ? saved.toObject() : saved,
        planName,
        pricePerCycle: manual.currentPlan?.pricePerCycle || pricePerCycle,
      });
    } catch (error) {
      // Plan change should succeed even if invoice email fails
      console.error('[invoice] Failed to issue plan-change invoice:', error.message);
    }

    return {
      ...(saved.toObject ? saved.toObject() : saved),
      billing,
      invoice,
    };
  }

  /**
   * Grant or replace a free trial on an existing client (no payment / invoice).
   */
  async grantTrial(id, { planId, planCode, planName: planNameInput, days } = {}, grantedBy = null) {
    let plan = null;
    if (planId) {
      plan = await PlanRepository.findById(planId);
    }
    if (!plan && planCode) {
      plan = await PlanRepository.findByCode(String(planCode).trim());
    }
    if (!plan && planNameInput) {
      plan =
        (await PlanRepository.findByCode(String(planNameInput).trim())) ||
        (await PlanRepository.findByName(String(planNameInput).trim()));
    }

    if (!plan) {
      throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND);
    }
    if (plan.status === 'Inactive' || plan.enabled === false) {
      throw new AppError('This plan is inactive', HTTP_STATUS.BAD_REQUEST);
    }
    if (plan.priceCustom) {
      throw new AppError('Custom / contact-sales plans cannot be used for trials', HTTP_STATUS.BAD_REQUEST);
    }

    const trialDays = Math.min(3650, Math.max(1, Number(days) || 14));
    const tenant = await TenantRepository.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    const ensured = ensureBillingLedger(tenant);
    if (ensured.needsPersist) {
      await TenantRepository.updateById(id, {
        currentPlan: ensured.tenant.currentPlan,
        billingHistory: ensured.tenant.billingHistory,
      });
    }

    const base = ensured.needsPersist ? await TenantRepository.findById(id) : tenant;
    const { tenant: updated, billing } = applyTrialPlan(base, {
      planName: plan.name,
      planCode: plan.code,
      catalogPricePerCycle: Number(plan.priceAmount) || 0,
      billing: plan.billing || 'Monthly',
      days: trialDays,
      grantedBy,
    });

    const saved = await TenantRepository.updateById(id, {
      currentPlan: updated.currentPlan,
      pendingPlan: updated.pendingPlan,
      billingHistory: updated.billingHistory,
      subscriptionSource: updated.subscriptionSource,
      trial: updated.trial,
      status: updated.status,
    });

    try {
      const owner = saved.owner || tenant.owner || null;
      const to = String(owner?.email || '').trim().toLowerCase();
      if (to) {
        const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
        await sendFreeTrialStartedEmail({
          to,
          name: ownerName,
          shopName: saved.name || tenant.name || '',
          planName: plan.name,
          trialDays,
          endsAt: updated.currentPlan?.endsAt || updated.trial?.endsAt || null,
          loginUrl: `${config.frontendUrl}/`,
        });
      }
    } catch (error) {
      console.error('[trial] Failed to email SA-granted free-trial confirmation:', error.message || error);
    }

    return {
      ...(saved.toObject ? saved.toObject() : saved),
      billing,
    };
  }

  /**
   * Extend trial endsAt by N calendar days on the same registration.
   */
  async extendTrial(id, { days } = {}) {
    const extraDays = Math.min(3650, Math.max(1, Number(days) || 1));
    const tenant = await TenantRepository.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    const isOnTrial =
      tenant.subscriptionSource === 'trial' ||
      Boolean(tenant.trial?.active) ||
      Boolean(tenant.trial?.endsAt);

    if (!isOnTrial) {
      throw new AppError('Client is not on a free trial', HTTP_STATUS.BAD_REQUEST);
    }
    if (!tenant.currentPlan?.name) {
      throw new AppError('Client has no plan to extend', HTTP_STATUS.BAD_REQUEST);
    }

    const { tenant: updated, billing } = extendTrialOrPlan(tenant, { extraDays });
    const saved = await TenantRepository.updateById(id, {
      currentPlan: updated.currentPlan,
      pendingPlan: updated.pendingPlan,
      subscriptionSource: updated.subscriptionSource,
      trial: updated.trial,
    });

    return {
      ...(saved.toObject ? saved.toObject() : saved),
      billing,
    };
  }

  /**
   * Super Admin free-trial analytics: KPIs, daily series, client list.
   */
  async getTrialReports(query = {}) {
    const now = new Date();
    const from = query.from ? new Date(`${String(query.from).slice(0, 10)}T00:00:00.000Z`) : null;
    const to = query.to ? new Date(`${String(query.to).slice(0, 10)}T23:59:59.999Z`) : null;
    const statusFilter = String(query.status || 'all').trim().toLowerCase();
    const originFilter = String(query.origin || 'all').trim().toLowerCase();
    const planFilter = String(query.plan || '').trim().toLowerCase();
    const search = String(query.search || '').trim().toLowerCase();
    const sort = String(query.sort || 'ending').trim().toLowerCase();

    const tenants = await TenantRepository.findTrialReportCandidates();
    const planSet = new Set();
    const candidates = [];

    for (const tenant of tenants) {
      const trial = tenant.trial || {};
      const startedAt = trial.startedAt || trial.grantedAt || null;
      const endsAt = trial.endsAt || getEffectiveEndsAt(tenant.currentPlan) || null;
      const convertedAt = trial.convertedAt || null;
      const onTrialSource = tenant.subscriptionSource === 'trial' || Boolean(trial.active);
      const daysRemaining = calendarDaysRemaining(endsAt, now);
      const expired = onTrialSource && daysRemaining != null && daysRemaining < 0;
      const active = onTrialSource && !expired && Boolean(trial.planName || tenant.currentPlan?.name);
      const converted = Boolean(convertedAt) && !onTrialSource;

      const hadTrial =
        active ||
        expired ||
        converted ||
        Boolean(startedAt) ||
        Boolean(trial.planName) ||
        (Array.isArray(tenant.billingHistory) &&
          tenant.billingHistory.some((seg) => seg.kind === 'trial'));
      if (!hadTrial) continue;

      const planName = trial.planName || tenant.currentPlan?.name || '—';
      if (planName && planName !== '—') planSet.add(planName);

      let status = 'inactive';
      if (active) status = daysRemaining != null && daysRemaining <= 7 ? 'expiring_soon' : 'active';
      else if (expired) status = 'expired';
      else if (converted) status = 'converted';

      const origin = trial.grantedBy ? 'admin' : 'signup';
      const owner = tenant.owner || {};
      const ownerName =
        owner.fullName ||
        [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() ||
        '';
      const ownerEmail = String(owner.email || '').trim().toLowerCase();

      candidates.push({
        id: String(tenant._id),
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        trialStatus: status,
        planName,
        planCode: trial.planCode || '',
        origin,
        startedAt,
        endsAt,
        convertedAt,
        daysRemaining,
        extendedCount: Number(trial.extendedCount) || 0,
        catalogPricePerCycle: Number(trial.catalogPricePerCycle) || 0,
        owner: {
          id: owner._id ? String(owner._id) : null,
          name: ownerName || '—',
          email: ownerEmail || '—',
        },
      });
    }

    const inRange = (row) => {
      if (!from && !to) return true;
      const anchor = row.startedAt
        ? new Date(row.startedAt)
        : row.convertedAt
          ? new Date(row.convertedAt)
          : null;
      if (!anchor || Number.isNaN(anchor.getTime())) return false;
      if (from && anchor < from) return false;
      if (to && anchor > to) return false;
      return true;
    };

    let rows = candidates.filter((row) => {
      if ((from || to) && !inRange(row)) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && row.trialStatus !== 'active' && row.trialStatus !== 'expiring_soon') {
          return false;
        }
        if (statusFilter === 'expired' && row.trialStatus !== 'expired') return false;
        if (statusFilter === 'converted' && row.trialStatus !== 'converted') return false;
        if (statusFilter === 'expiring_soon' && row.trialStatus !== 'expiring_soon') return false;
      }
      if (originFilter !== 'all' && row.origin !== originFilter) return false;
      if (planFilter && String(row.planName).toLowerCase() !== planFilter) return false;
      if (search) {
        const hay = `${row.name || ''} ${row.owner?.name || ''} ${row.owner?.email || ''} ${row.planName}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      if (sort === 'newest') return new Date(b.startedAt || 0) - new Date(a.startedAt || 0);
      if (sort === 'oldest') return new Date(a.startedAt || 0) - new Date(b.startedAt || 0);
      if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sort === 'converted') return new Date(b.convertedAt || 0) - new Date(a.convertedAt || 0);
      const da = a.daysRemaining;
      const db = b.daysRemaining;
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });

    const seriesMap = new Map();
    for (const row of rows) {
      if (!row.startedAt) continue;
      const key = new Date(row.startedAt).toISOString().slice(0, 10);
      seriesMap.set(key, (seriesMap.get(key) || 0) + 1);
    }
    const series = Array.from(seriesMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const active = rows.filter((r) => r.trialStatus === 'active' || r.trialStatus === 'expiring_soon').length;
    const expired = rows.filter((r) => r.trialStatus === 'expired').length;
    const converted = rows.filter((r) => r.trialStatus === 'converted').length;
    const decided = active + expired + converted;
    const conversionRate = decided > 0 ? Math.round((converted / decided) * 1000) / 10 : 0;

    return {
      summary: {
        active,
        expired,
        converted,
        startedInRange: rows.filter((r) => r.startedAt).length,
        totalExtensions: rows.reduce((sum, r) => sum + (Number(r.extendedCount) || 0), 0),
        signupOrigin: rows.filter((r) => r.origin === 'signup').length,
        adminOrigin: rows.filter((r) => r.origin === 'admin').length,
        conversionRate,
        clients: rows.length,
        expiringSoon: rows.filter((r) => r.trialStatus === 'expiring_soon').length,
      },
      series,
      plans: Array.from(planSet).sort((a, b) => a.localeCompare(b)),
      items: rows,
      range: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
    };
  }

  async remove(id) {
    const tenant = await TenantRepository.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    const ownerId = tenant.owner?._id || tenant.owner || null;
    const ownerEmail = String(tenant.owner?.email || '')
      .trim()
      .toLowerCase() || null;

    // Delete tenant first so orphan repair cannot resurrect this shop
    const deleted = await TenantRepository.deleteById(id);
    if (!deleted) {
      throw new AppError('Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    // Wipe checkout history for this email so re-registration starts clean
    // (revenue, discount codes, partner first-payment, affiliate portfolio)
    const emailsToPurge = new Set();
    if (ownerEmail) emailsToPurge.add(ownerEmail);

    if (ownerId) {
      await Promise.all([
        RefreshTokenRepository.deleteByUser(ownerId),
        OAuthRepository.deleteByUser(ownerId),
      ]);

      if (ownerEmail) {
        await EmailOtpRepository.deleteByEmail(ownerEmail);
      }

      // Remove the admin account so repairOrphanedAdminTenants does not recreate the client
      await UserRepository.deleteById(ownerId);
    }

    // Clear any other users still pointing at this tenant
    const { User } = require('@models');
    const leftoverUsers = await User.find({ tenant: id }).select('_id email');
    for (const leftover of leftoverUsers) {
      const leftoverEmail = String(leftover.email || '')
        .trim()
        .toLowerCase();
      if (leftoverEmail) emailsToPurge.add(leftoverEmail);
      await Promise.all([
        RefreshTokenRepository.deleteByUser(leftover._id),
        OAuthRepository.deleteByUser(leftover._id),
      ]);
      if (leftoverEmail) await EmailOtpRepository.deleteByEmail(leftoverEmail);
      await UserRepository.deleteById(leftover._id);
    }

    for (const email of emailsToPurge) {
      try {
        await PaymentRepository.deleteByCustomerEmail(email);
      } catch (error) {
        console.error('[tenant.remove] Failed to purge payments for', email, error.message);
      }
    }

    return deleted;
  }
}

module.exports = new TenantService();
