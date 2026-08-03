const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { User } = require('@models');
const PlanRepository = require('@repositories/plan.repository');
const FeatureRepository = require('@repositories/feature.repository');
const DiscountRepository = require('@repositories/discount.repository');
const { normalizePlanPayload, toPlanView, toPublicPlanView } = require('@helpers/plan.helper');
const { ANY_PLAN } = require('@helpers/discount.helper');

async function getActiveUserCountsByPlanName() {
  const rows = await User.aggregate([
    { $match: { isActive: true, tenant: { $ne: null } } },
    {
      $lookup: {
        from: 'tenants',
        localField: 'tenant',
        foreignField: '_id',
        as: 'tenantDoc',
      },
    },
    { $unwind: '$tenantDoc' },
    {
      $match: {
        'tenantDoc.currentPlan.name': { $nin: [null, ''] },
      },
    },
    {
      $group: {
        _id: { $toLower: '$tenantDoc.currentPlan.name' },
        count: { $sum: 1 },
      },
    },
  ]);

  const map = {};
  for (const row of rows) {
    if (row._id) map[row._id] = row.count;
  }
  return map;
}

async function getDiscountStatsByPlanName() {
  const result = await DiscountRepository.findAll(
    { specificPlan: { $nin: [null, '', ANY_PLAN] } },
    { page: 1, limit: 1000, search: '' }
  );

  const map = {};
  for (const item of result.discounts || []) {
    const key = String(item.specificPlan || '').trim();
    if (!key) continue;
    if (!map[key]) {
      map[key] = { discountLinked: 0, discountCode: '' };
    }
    map[key].discountLinked += 1;
    if (!map[key].discountCode && item.enabled && item.code) {
      map[key].discountCode = item.code;
    }
    if (!map[key].discountCode && item.code) {
      map[key].discountCode = item.code;
    }
  }
  return map;
}

function withPlanExtras(planDoc, userCounts, discountStats = {}) {
  const name = String(planDoc.name || '');
  const nameKey = name.toLowerCase();
  const code = String(planDoc.code || '').toLowerCase();
  const activeUsers = userCounts[nameKey] || userCounts[code] || 0;
  const discountMeta = discountStats[name] || {};
  return toPlanView(planDoc, {
    activeUsers,
    discountLinked: discountMeta.discountLinked ?? planDoc.discountLinked ?? 0,
    discountCode: discountMeta.discountCode ?? planDoc.discountCode ?? '',
  });
}

async function persistDiscountFields(plan) {
  if (!plan?.name) return plan;
  const linked = await DiscountRepository.findBySpecificPlan(plan.name);
  const enabledCodes = linked
    .filter((item) => item.enabled)
    .map((item) => item.code)
    .filter(Boolean);
  return PlanRepository.updateById(plan._id || plan.id, {
    discountLinked: linked.length,
    discountCode: enabledCodes[0] || linked[0]?.code || '',
  });
}

class PlanService {
  async create(body) {
    const data = normalizePlanPayload(body);
    data.discountLinked = 0;
    data.discountCode = '';
    if (!data.name) throw new AppError('Plan name is required', HTTP_STATUS.BAD_REQUEST);
    if (!data.code) throw new AppError('Plan code is required', HTTP_STATUS.BAD_REQUEST);
    if (!data.priceCustom && data.priceAmount < 0) {
      throw new AppError('Price must be zero or greater', HTTP_STATUS.BAD_REQUEST);
    }
    if (!data.usersUnlimited && data.users < 0) {
      throw new AppError('Users limit must be zero or greater', HTTP_STATUS.BAD_REQUEST);
    }

    const existing = await PlanRepository.findByCode(data.code);
    if (existing) throw new AppError('Plan code already exists', HTTP_STATUS.CONFLICT);

    if (data.features.length) {
      for (const featureId of data.features) {
        const feature = await FeatureRepository.findById(featureId);
        if (!feature) {
          throw new AppError(`Feature not found: ${featureId}`, HTTP_STATUS.BAD_REQUEST);
        }
      }
    }

    let plan = await PlanRepository.create(data);
    plan = (await persistDiscountFields(plan)) || plan;
    return withPlanExtras(plan, {}, {});
  }

  async getAll(query = {}) {
    const { page, limit, search, status, visibleSuperAdmin, includeHidden, lite } = query;
    const filter = {};
    if (status) {
      filter.status =
        status === 'inactive' ? 'Inactive' : status === 'active' ? 'Active' : status;
    }

    if (String(includeHidden) !== 'true' && String(includeHidden) !== '1') {
      if (visibleSuperAdmin === 'false' || visibleSuperAdmin === false) {
        filter.visibleSuperAdmin = false;
      } else {
        filter.visibleSuperAdmin = true;
      }
    }

    const isLite = String(lite) === 'true' || String(lite) === '1';

    if (isLite) {
      const result = await PlanRepository.findAll(filter, {
        page: Number(page) || 1,
        limit: Number(limit) || 200,
        search: search || '',
      });
      return {
        plans: result.plans.map((plan) => withPlanExtras(plan, {}, {})),
        pagination: result.pagination,
      };
    }

    const [result, counts, discountStats] = await Promise.all([
      PlanRepository.findAll(filter, {
        page: Number(page) || 1,
        limit: Number(limit) || 200,
        search: search || '',
      }),
      getActiveUserCountsByPlanName(),
      getDiscountStatsByPlanName(),
    ]);

    return {
      plans: result.plans.map((plan) => withPlanExtras(plan, counts, discountStats)),
      pagination: result.pagination,
    };
  }

  async getPublic({ forOutlet = false } = {}) {
    // Website visibility alone controls listing. Disabled plans still appear;
    // the pricing CTA shows a toast instead of starting checkout.
    // Outlet seat plans are excluded from normal pricing unless forOutlet=true.
    const wantOutlet = Boolean(forOutlet);
    const result = await PlanRepository.findAll(
      {
        visibleWebsite: true,
        ...(wantOutlet ? { forOutlet: true } : { forOutlet: { $ne: true } }),
      },
      {
        page: 1,
        limit: 50,
        sort: 'priceAmount',
        search: '',
      }
    );

    const plans = result.plans
      .map(toPublicPlanView)
      .filter((plan) => Boolean(plan.forOutlet) === wantOutlet)
      .sort((a, b) => {
        if (a.priceCustom && !b.priceCustom) return 1;
        if (!a.priceCustom && b.priceCustom) return -1;
        return a.priceAmount - b.priceAmount;
      });

    return { plans, forOutlet: wantOutlet };
  }

  async getById(id) {
    const plan = await PlanRepository.findById(id);
    if (!plan) throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND);
    const [counts, discountStats] = await Promise.all([
      getActiveUserCountsByPlanName(),
      getDiscountStatsByPlanName(),
    ]);
    return withPlanExtras(plan, counts, discountStats);
  }

  async update(id, body) {
    const existing = await PlanRepository.findById(id);
    if (!existing) throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND);

    const current = existing.toObject();
    const currentFeatureIds = (current.features || []).map((item) =>
      typeof item === 'object' && item?._id ? String(item._id) : String(item)
    );

    const merged = {
      name: body.name !== undefined ? body.name : current.name,
      code: body.code !== undefined ? body.code : current.code,
      priceAmount: body.priceAmount !== undefined ? body.priceAmount : current.priceAmount,
      mrpAmount: body.mrpAmount !== undefined ? body.mrpAmount : current.mrpAmount,
      priceCustom: body.priceCustom !== undefined ? body.priceCustom : current.priceCustom,
      billing: body.billing !== undefined ? body.billing : current.billing,
      featureIds: body.featureIds !== undefined ? body.featureIds : currentFeatureIds,
      status: body.status !== undefined ? body.status : current.status,
      users: body.users !== undefined ? body.users : current.users,
      usersUnlimited:
        body.usersUnlimited !== undefined ? body.usersUnlimited : Boolean(current.usersUnlimited),
      discountLinked: current.discountLinked,
      discountCode: current.discountCode,
      visibleWebsite:
        body.visibleWebsite !== undefined ? body.visibleWebsite : current.visibleWebsite,
      visibleSuperAdmin:
        body.visibleSuperAdmin !== undefined
          ? body.visibleSuperAdmin
          : current.visibleSuperAdmin,
      enabled: body.enabled !== undefined ? body.enabled : current.enabled,
      description: body.description !== undefined ? body.description : current.description,
      ctaText: body.ctaText !== undefined ? body.ctaText : current.ctaText,
      featuredOnWebsite:
        body.featuredOnWebsite !== undefined
          ? body.featuredOnWebsite
          : Boolean(current.featuredOnWebsite),
      badgeText: body.badgeText !== undefined ? body.badgeText : current.badgeText,
      forOutlet: body.forOutlet !== undefined ? body.forOutlet : Boolean(current.forOutlet),
    };

    if (body.enabled !== undefined && body.status === undefined) {
      merged.status = body.enabled ? 'Active' : 'Inactive';
    }

    const data = normalizePlanPayload(merged);
    data.discountLinked = current.discountLinked;
    data.discountCode = current.discountCode;

    if (body.code && data.code !== current.code) {
      const conflict = await PlanRepository.findByCode(data.code);
      if (conflict) throw new AppError('Plan code already exists', HTTP_STATUS.CONFLICT);
    }

    if (data.features.length) {
      for (const featureId of data.features) {
        const feature = await FeatureRepository.findById(featureId);
        if (!feature) {
          throw new AppError(`Feature not found: ${featureId}`, HTTP_STATUS.BAD_REQUEST);
        }
      }
    }

    let updated = await PlanRepository.updateById(id, data);
    updated = (await persistDiscountFields(updated)) || updated;
    const [counts, discountStats] = await Promise.all([
      getActiveUserCountsByPlanName(),
      getDiscountStatsByPlanName(),
    ]);
    return withPlanExtras(updated, counts, discountStats);
  }

  async remove(id) {
    const plan = await PlanRepository.deleteById(id);
    if (!plan) throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND);
    return { id };
  }

  async removeMany(ids = []) {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];
    if (!uniqueIds.length) throw new AppError('No plans selected', HTTP_STATUS.BAD_REQUEST);
    await PlanRepository.deleteManyByIds(uniqueIds);
    return { deleted: uniqueIds.length };
  }
}

module.exports = new PlanService();
