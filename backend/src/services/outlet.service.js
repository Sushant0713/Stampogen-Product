const AppError = require('@utils/AppError');
const { HTTP_STATUS, TENANT_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const { slugify } = require('@helpers');
const config = require('@config');
const TenantRepository = require('@repositories/tenant.repository');
const UserRepository = require('@repositories/user.repository');
const RoleRepository = require('@repositories/role.repository');
const PlanRepository = require('@repositories/plan.repository');
const { computePlanEndsAt } = require('@helpers/billing.helper');
const { sendAdminClientCredentialsEmail } = require('@services/email.service');

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
   * After paid checkout of an outlet plan — add one seat on the HQ tenant.
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

    const purchasedAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
    const billing = payment.billing || plan.billing || 'Monthly';
    const pricePerCycle =
      payment.taxableAmount != null
        ? Number(payment.taxableAmount)
        : Math.max(0, Number(payment.listAmount || 0) - Number(payment.discountAmount || 0));

    const seat = {
      planCode: plan.code || payment.planCode || '',
      planName: plan.name || payment.planName || '',
      pricePerCycle,
      billing,
      purchasedAt,
      startsAt: purchasedAt,
      endsAt: computePlanEndsAt(purchasedAt, billing),
      paymentId: payment._id || null,
      outletTenantId: null,
    };

    const seats = [...(tenant.outletSeats || []), seat];
    return TenantRepository.updateById(tenantId, { outletSeats: seats });
  }

  async getDashboard(adminUser) {
    const hq = await this.getHqTenantForAdmin(adminUser);
    const seats = (hq.outletSeats || []).map(formatSeat);
    const activeSeats = seats.filter((s) => s.active);
    const unusedSeats = activeSeats.filter((s) => !s.used);
    const outlets = await TenantRepository.findOutletsByParent(hq._id);

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
      outlets: outlets.map((o) => ({
        id: String(o._id),
        name: o.name,
        slug: o.slug,
        status: o.status,
        createdAt: o.createdAt,
        ownerEmail: o.owner?.email || '',
        ownerName: [o.owner?.firstName, o.owner?.lastName].filter(Boolean).join(' ').trim(),
      })),
      canAddOutlet: unusedSeats.length > 0,
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
