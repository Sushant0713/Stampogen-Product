const AppError = require('@utils/AppError');
const { HTTP_STATUS, TENANT_STATUS } = require('@constants');
const { slugify } = require('@helpers');
const TenantRepository = require('@repositories/tenant.repository');
const UserRepository = require('@repositories/user.repository');
const PlanRepository = require('@repositories/plan.repository');
const OAuthRepository = require('@repositories/oauth.repository');
const RefreshTokenRepository = require('@repositories/refreshToken.repository');
const EmailOtpRepository = require('@repositories/emailOtp.repository');
const PlatformInvoiceService = require('@services/platformInvoice.service');
const PaymentRepository = require('@repositories/payment.repository');
const {
  PLAN_RATES,
  buildSegment,
  ensureBillingLedger,
  applyPlanChange,
  summarizeBilling,
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
    const saved = await TenantRepository.updateById(id, {
      currentPlan: updated.currentPlan,
      pendingPlan: updated.pendingPlan,
      billingHistory: updated.billingHistory,
    });

    let invoice = null;
    try {
      invoice = await PlatformInvoiceService.issueForPlanChange({
        tenant: saved.toObject ? saved.toObject() : saved,
        planName,
        pricePerCycle: updated.currentPlan?.pricePerCycle || pricePerCycle,
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
