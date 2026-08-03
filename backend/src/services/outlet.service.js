const AppError = require('@utils/AppError');
const { HTTP_STATUS, TENANT_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const { slugify } = require('@helpers');
const config = require('@config');
const TenantRepository = require('@repositories/tenant.repository');
const UserRepository = require('@repositories/user.repository');
const RoleRepository = require('@repositories/role.repository');
const PlanRepository = require('@repositories/plan.repository');
const {
  computePlanEndsAt,
  scheduleOrApplyPurchase,
  markSubscriptionPaid,
  getSubscriptionView,
} = require('@helpers/billing.helper');
const { sendAdminClientCredentialsEmail } = require('@services/email.service');
const { normalizeBillingProfile } = require('@helpers/billingProfile.helper');

function isSeatActive(seat, asOf = new Date()) {
  if (!seat) return false;
  if (!seat.endsAt) return true;
  const end = new Date(seat.endsAt);
  if (Number.isNaN(end.getTime())) return true;
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end.getTime() >= today.getTime();
}

function formatSeat(seat) {
  const plain = seat?.toObject ? seat.toObject() : { ...seat };
  return {
    id: String(plain._id),
    planCode: plain.planCode || '',
    planName: plain.planName || '',
    pricePerCycle: Number(plain.pricePerCycle) || 0,
    billing: plain.billing || 'Monthly',
    purchasedAt: plain.purchasedAt || null,
    startsAt: plain.startsAt || null,
    endsAt: plain.endsAt || null,
    paymentId: plain.paymentId ? String(plain.paymentId) : null,
    outletTenantId: plain.outletTenantId ? String(plain.outletTenantId) : null,
    active: isSeatActive(plain),
    used: Boolean(plain.outletTenantId),
  };
}

function assertHqAdmin(user, tenant) {
  if (!tenant) {
    throw new AppError('Shop not found', HTTP_STATUS.BAD_REQUEST);
  }
  if (tenant.kind === 'outlet' || tenant.parentTenant) {
    throw new AppError('Outlet accounts cannot manage outlets', HTTP_STATUS.FORBIDDEN);
  }
  const ownerId = tenant.owner?._id || tenant.owner;
  const userId = user._id || user.id;
  if (String(ownerId) !== String(userId)) {
    // Still allow if user.tenant is this HQ (owner link)
    const userTenantId = user.tenant?._id || user.tenant;
    if (String(userTenantId) !== String(tenant._id || tenant.id)) {
      throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
    }
  }
}

class OutletService {
  async getHqTenantForAdmin(adminUser) {
    const tenantId = adminUser?.tenant?._id || adminUser?.tenant;
    if (!tenantId) {
      throw new AppError('Shop organization not found', HTTP_STATUS.BAD_REQUEST);
    }
    const tenant = await TenantRepository.findById(tenantId);
    if (!tenant) {
      throw new AppError('Shop not found', HTTP_STATUS.NOT_FOUND);
    }
    assertHqAdmin(adminUser, tenant);
    return tenant;
  }

  /**
   * After paid checkout of an outlet plan — add one seat on the HQ tenant,
   * or renew/change plan for a specific outlet when renewOutletTenantId is set.
   */
  async grantSeatFromPayment(payment, plan) {
    const email = String(payment.customerEmail || '')
      .trim()
      .toLowerCase();
    if (!email || !plan?.forOutlet) return null;

    const user = await UserRepository.findByEmail(email);
    const tenantId = user?.tenant?._id || user?.tenant;
    if (!tenantId) return null;

    const tenant = await TenantRepository.findById(tenantId);
    if (!tenant || tenant.kind === 'outlet') return null;

    const renewOutletId = payment.renewOutletTenantId
      ? String(payment.renewOutletTenantId)
      : '';
    if (renewOutletId) {
      return this.renewOutletFromPayment(payment, plan, tenant, renewOutletId);
    }

    const purchasedAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
    const billing = payment.billing || plan.billing || 'Monthly';
    const quantity = Math.min(50, Math.max(1, Math.floor(Number(payment.quantity) || 1)));
    const taxableTotal =
      payment.taxableAmount != null
        ? Number(payment.taxableAmount)
        : Math.max(0, Number(payment.listAmount || 0) - Number(payment.discountAmount || 0));
    const pricePerCycle = Math.round((taxableTotal / quantity) * 100) / 100;

    const newSeats = Array.from({ length: quantity }, () => ({
      planCode: plan.code || payment.planCode || '',
      planName: plan.name || payment.planName || '',
      pricePerCycle,
      billing,
      purchasedAt,
      startsAt: purchasedAt,
      endsAt: computePlanEndsAt(purchasedAt, billing),
      paymentId: payment._id || null,
      outletTenantId: null,
    }));

    const seats = [...(tenant.outletSeats || []), ...newSeats];
    return TenantRepository.updateById(tenantId, { outletSeats: seats });
  }

  /**
   * Renew or change the plan for an existing outlet (extends / replaces seat + outlet currentPlan).
   */
  async renewOutletFromPayment(payment, plan, hqTenant, outletTenantId) {
    const outlet = await TenantRepository.findById(outletTenantId);
    if (!outlet || outlet.kind !== 'outlet') {
      throw new AppError('Outlet not found', HTTP_STATUS.NOT_FOUND);
    }
    const parentId = outlet.parentTenant?._id || outlet.parentTenant;
    if (String(parentId) !== String(hqTenant._id)) {
      throw new AppError('Outlet does not belong to this shop', HTTP_STATUS.FORBIDDEN);
    }

    const purchasedAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
    const billing = payment.billing || plan.billing || 'Monthly';
    const pricePerCycle =
      payment.taxableAmount != null
        ? Number(payment.taxableAmount)
        : Math.max(0, Number(payment.listAmount || 0) - Number(payment.discountAmount || 0));

    const { tenant: scheduled } = scheduleOrApplyPurchase(outlet, {
      planName: plan.name || payment.planName,
      pricePerCycle,
      billing,
      purchasedAt,
    });
    const paid = markSubscriptionPaid(scheduled);

    await TenantRepository.updateById(outlet._id, {
      currentPlan: paid.currentPlan,
      pendingPlan: paid.pendingPlan,
      billingHistory: paid.billingHistory,
      subscriptionSource: paid.subscriptionSource,
      trial: paid.trial,
      status: TENANT_STATUS.ACTIVE,
    });

    const seatEndsAt =
      paid.currentPlan?.endsAt || computePlanEndsAt(purchasedAt, billing);
    const seats = [...(hqTenant.outletSeats || [])];
    const seatIndex = seats.findIndex(
      (s) => s.outletTenantId && String(s.outletTenantId) === String(outlet._id)
    );
    const seatPatch = {
      planCode: plan.code || payment.planCode || '',
      planName: plan.name || payment.planName || '',
      pricePerCycle,
      billing,
      purchasedAt,
      startsAt: paid.currentPlan?.startedAt || purchasedAt,
      endsAt: seatEndsAt,
      paymentId: payment._id || null,
      outletTenantId: outlet._id,
    };

    if (seatIndex >= 0) {
      const prev = seats[seatIndex];
      seats[seatIndex] = {
        ...(prev.toObject ? prev.toObject() : prev),
        ...seatPatch,
      };
    } else {
      seats.push(seatPatch);
    }

    return TenantRepository.updateById(hqTenant._id, { outletSeats: seats });
  }

  async getDashboard(adminUser) {
    const hq = await this.getHqTenantForAdmin(adminUser);
    const seats = (hq.outletSeats || []).map(formatSeat);
    const activeSeats = seats.filter((s) => s.active);
    const unusedSeats = activeSeats.filter((s) => !s.used);
    const outlets = await TenantRepository.findOutletsByParent(hq._id);
    const LoyaltyService = require('@services/loyalty.service');

    const outletRows = await Promise.all(
      outlets.map(async (o) => {
        const id = String(o._id);
        const seat = seats.find((s) => s.outletTenantId === id) || null;
        const sub = getSubscriptionView(o);
        const endsAt = sub?.endsAt || o.currentPlan?.endsAt || seat?.endsAt || null;
        const planActive =
          endsAt
            ? isSeatActive({ endsAt })
            : Boolean(sub?.planName && !['expired', 'trial_expired'].includes(sub?.status));
        const expired =
          Boolean(sub?.planName) &&
          (sub.status === 'expired' ||
            sub.status === 'trial_expired' ||
            (sub.daysRemaining != null && sub.daysRemaining < 0) ||
            (endsAt && !isSeatActive({ endsAt })));

        let stats = {
          totalCustomers: 0,
          pendingRewards: 0,
          pendingStampRequests: 0,
          redeemedRewards: 0,
          repeatCustomers: 0,
          totalStamps: 0,
          activeCampaigns: 0,
          qrScans: { month: '', monthLabel: '', total: 0, days: [] },
        };
        try {
          stats = await LoyaltyService.getTenantDashboardStats(o._id);
        } catch {
          // Keep zeroed stats if an outlet is misconfigured
        }

        return {
          id,
          name: o.name,
          slug: o.slug,
          status: o.status,
          createdAt: o.createdAt,
          ownerEmail: o.owner?.email || '',
          ownerName: [o.owner?.firstName, o.owner?.lastName].filter(Boolean).join(' ').trim(),
          planName: sub?.planName || seat?.planName || o.currentPlan?.name || '',
          planCode: seat?.planCode || '',
          planEndsAt: endsAt,
          planActive: Boolean(planActive) && !expired,
          expired: Boolean(expired),
          seatId: seat?.id || null,
          daysRemaining: sub?.daysRemaining ?? null,
          stats: {
            totalCustomers: Number(stats.totalCustomers) || 0,
            pendingRewards: Number(stats.pendingRewards) || 0,
            pendingStampRequests: Number(stats.pendingStampRequests) || 0,
            redeemedRewards: Number(stats.redeemedRewards) || 0,
            repeatCustomers: Number(stats.repeatCustomers) || 0,
            totalStamps: Number(stats.totalStamps) || 0,
            activeCampaigns: Number(stats.activeCampaigns) || 0,
            qrScansMonth: Number(stats.qrScans?.total) || 0,
            qrScansMonthLabel: stats.qrScans?.monthLabel || '',
          },
        };
      })
    );

    const totals = outletRows.reduce(
      (acc, row) => {
        acc.totalCustomers += row.stats.totalCustomers;
        acc.pendingRewards += row.stats.pendingRewards;
        acc.pendingStampRequests += row.stats.pendingStampRequests;
        acc.redeemedRewards += row.stats.redeemedRewards;
        acc.repeatCustomers += row.stats.repeatCustomers;
        acc.totalStamps += row.stats.totalStamps;
        acc.qrScansMonth += row.stats.qrScansMonth;
        return acc;
      },
      {
        outlets: outletRows.length,
        activeOutlets: outletRows.filter((o) => !o.expired && o.status === 'active').length,
        expiredOutlets: outletRows.filter((o) => o.expired).length,
        totalCustomers: 0,
        pendingRewards: 0,
        pendingStampRequests: 0,
        redeemedRewards: 0,
        repeatCustomers: 0,
        totalStamps: 0,
        qrScansMonth: 0,
      }
    );

    return {
      hq: {
        id: String(hq._id),
        name: hq.name,
        slug: hq.slug,
      },
      seats: {
        total: seats.length,
        active: activeSeats.length,
        used: activeSeats.filter((s) => s.used).length,
        unused: unusedSeats.length,
        items: seats.sort(
          (a, b) => new Date(b.purchasedAt || 0).getTime() - new Date(a.purchasedAt || 0).getTime()
        ),
      },
      outlets: outletRows,
      expiredOutlets: outletRows.filter((o) => o.expired),
      canAddOutlet: unusedSeats.length > 0,
      totals,
    };
  }

  async listSeats(adminUser) {
    const dash = await this.getDashboard(adminUser);
    return dash.seats;
  }

  async createOutlet(
    adminUser,
    { name, email, password, firstName, lastName, seatId } = {}
  ) {
    const hq = await this.getHqTenantForAdmin(adminUser);
    const outletName = String(name || '').trim();
    const outletEmail = String(email || '')
      .trim()
      .toLowerCase();
    const pass = String(password || '');
    const fName = String(firstName || 'Outlet').trim() || 'Outlet';
    const lName = String(lastName || 'Manager').trim() || 'Manager';

    if (!outletName) {
      throw new AppError('Outlet name is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!outletEmail) {
      throw new AppError('Outlet login email is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (pass.length < 8) {
      throw new AppError('Password must be at least 8 characters', HTTP_STATUS.BAD_REQUEST);
    }

    const seats = [...(hq.outletSeats || [])];
    let seatIndex = -1;
    if (seatId) {
      seatIndex = seats.findIndex((s) => String(s._id) === String(seatId));
    } else {
      seatIndex = seats.findIndex((s) => !s.outletTenantId && isSeatActive(s));
    }
    if (seatIndex < 0) {
      throw new AppError(
        'No unused outlet plan seat. Buy an outlet plan before adding an outlet.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    const seat = seats[seatIndex];
    if (seat.outletTenantId) {
      throw new AppError('That outlet seat is already used', HTTP_STATUS.BAD_REQUEST);
    }
    if (!isSeatActive(seat)) {
      throw new AppError('That outlet plan seat has expired', HTTP_STATUS.BAD_REQUEST);
    }

    const existingUser = await UserRepository.findByEmail(outletEmail);
    if (existingUser) {
      throw new AppError('Email already registered. Use a different login email.', HTTP_STATUS.CONFLICT);
    }

    let slug = slugify(outletName);
    if (!slug) slug = `outlet-${Date.now().toString(36)}`;
    let uniqueSlug = slug;
    let n = 1;
    while (await TenantRepository.findBySlug(uniqueSlug)) {
      uniqueSlug = `${slug}-${n}`;
      n += 1;
    }

    const role = await RoleRepository.findBySlug(ROLES.ADMIN);
    if (!role) {
      throw new AppError('Admin role not configured', HTTP_STATUS.INTERNAL_SERVER);
    }

    const outletUser = await UserRepository.create({
      firstName: fName,
      lastName: lName,
      email: outletEmail,
      password: pass,
      role: role._id,
      isEmailVerified: true,
      isActive: true,
    });

    const outletTenant = await TenantRepository.create({
      name: outletName,
      slug: uniqueSlug,
      owner: outletUser._id,
      kind: 'outlet',
      parentTenant: hq._id,
      status: TENANT_STATUS.ACTIVE,
      loyaltyStampMode: hq.loyaltyStampMode || 'bill',
      category: hq.category || undefined,
      customCategory: hq.customCategory || '',
      billingProfile: normalizeBillingProfile(hq.billingProfile || {}),
      // Outlet uses HQ subscription gate via parent — give a mirror plan label for UI
      currentPlan: {
        name: seat.planName || 'Outlet',
        pricePerCycle: Number(seat.pricePerCycle) || 0,
        startedAt: seat.startsAt || new Date(),
        billing: seat.billing || 'Monthly',
        endsAt: seat.endsAt || null,
      },
      subscriptionSource: 'paid',
    });

    await UserRepository.updateById(outletUser._id, { tenant: outletTenant._id });

    seats[seatIndex] = {
      ...(seat.toObject ? seat.toObject() : seat),
      outletTenantId: outletTenant._id,
    };
    await TenantRepository.updateById(hq._id, { outletSeats: seats });

    try {
      await sendAdminClientCredentialsEmail({
        to: outletEmail,
        name: fName,
        email: outletEmail,
        password: pass,
        shopName: outletName,
        loginUrl: `${config.frontendUrl}/admin/login`,
      });
    } catch (error) {
      console.error('[outlet] Failed to email outlet credentials:', error.message || error);
    }

    return {
      outlet: {
        id: String(outletTenant._id),
        name: outletTenant.name,
        slug: outletTenant.slug,
        status: outletTenant.status,
        ownerEmail: outletEmail,
      },
      seat: formatSeat(seats[seatIndex]),
      message: 'Outlet created. Manager can sign in with the email and password you set.',
    };
  }
}

module.exports = new OutletService();
