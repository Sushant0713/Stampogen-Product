const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { Plan } = require('@models');
const DiscountRepository = require('@repositories/discount.repository');
const {
  normalizePayload,
  toDiscountView,
  assertDiscountRules,
  ANY_PLAN,
} = require('@helpers/discount.helper');

async function syncPlanDiscountFields(planNames = []) {
  const names = [
    ...new Set(
      (planNames || [])
        .map((name) => String(name || '').trim())
        .filter((name) => name && name !== ANY_PLAN)
    ),
  ];

  for (const name of names) {
    const linked = await DiscountRepository.findBySpecificPlan(name);
    const enabledCodes = linked
      .filter((item) => item.enabled)
      .map((item) => item.code)
      .filter(Boolean);

    await Plan.updateMany(
      { name },
      {
        $set: {
          discountLinked: linked.length,
          discountCode: enabledCodes[0] || linked[0]?.code || '',
        },
      }
    );
  }
}

class DiscountService {
  async create(body) {
    const data = normalizePayload(body);
    assertDiscountRules(data);

    const existing = await DiscountRepository.findByCode(data.code);
    if (existing) {
      throw new AppError('Promo code already exists', HTTP_STATUS.CONFLICT);
    }

    const discount = await DiscountRepository.create(data);
    await syncPlanDiscountFields([data.specificPlan]);
    return toDiscountView(discount);
  }

  async getAll(query = {}) {
    const { page, limit, search, type } = query;
    const filter = {};
    if (type) filter.type = type;

    const result = await DiscountRepository.findAll(filter, {
      page: Number(page) || 1,
      limit: Number(limit) || 100,
      search: search || '',
    });

    return {
      discounts: result.discounts.map(toDiscountView),
      pagination: result.pagination,
    };
  }

  async getStats() {
    return DiscountRepository.getStats();
  }

  async getById(id) {
    const discount = await DiscountRepository.findById(id);
    if (!discount) {
      throw new AppError('Discount not found', HTTP_STATUS.NOT_FOUND);
    }
    return toDiscountView(discount);
  }

  async update(id, body) {
    const existing = await DiscountRepository.findById(id);
    if (!existing) {
      throw new AppError('Discount not found', HTTP_STATUS.NOT_FOUND);
    }

    const current = existing.toObject();
    const previousPlan = current.specificPlan;

    const merged = {
      name: body.name !== undefined ? body.name : current.name,
      code: body.code !== undefined ? body.code : current.code,
      description: body.description !== undefined ? body.description : current.description,
      type: body.type !== undefined ? body.type : current.type,
      amountType: body.amountType !== undefined ? body.amountType : current.amountType,
      amountValue: body.amountValue !== undefined ? body.amountValue : current.amountValue,
      planType: body.planType !== undefined ? body.planType : current.planType,
      specificPlan: body.specificPlan !== undefined ? body.specificPlan : current.specificPlan,
      billingCycle: body.billingCycle !== undefined ? body.billingCycle : current.billingCycle,
      minOrderAmount:
        body.minOrderAmount !== undefined ? body.minOrderAmount : current.minOrderAmount,
      maxUses: body.maxUses !== undefined ? body.maxUses : current.maxUses,
      startDate: body.startDate !== undefined ? body.startDate : current.startDate,
      endDate: body.endDate !== undefined ? body.endDate : current.endDate,
      enabled: body.enabled !== undefined ? body.enabled : current.enabled,
    };

    const data = normalizePayload(merged);
    assertDiscountRules(data);

    if (body.code && data.code !== current.code) {
      const conflict = await DiscountRepository.findByCode(data.code);
      if (conflict) {
        throw new AppError('Promo code already exists', HTTP_STATUS.CONFLICT);
      }
    }

    // Preserve usage counter on update
    data.usageUsed = current.usageUsed;

    const updated = await DiscountRepository.updateById(id, data);
    await syncPlanDiscountFields([previousPlan, data.specificPlan]);
    return toDiscountView(updated);
  }

  async remove(id) {
    const discount = await DiscountRepository.deleteById(id);
    if (!discount) {
      throw new AppError('Discount not found', HTTP_STATUS.NOT_FOUND);
    }
    await syncPlanDiscountFields([discount.specificPlan]);
    return toDiscountView(discount);
  }

  async removeMany(ids = []) {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];
    if (!uniqueIds.length) {
      throw new AppError('No discounts selected', HTTP_STATUS.BAD_REQUEST);
    }

    const existing = await DiscountRepository.findByIds(uniqueIds);
    const planNames = existing.map((item) => item.specificPlan);
    await DiscountRepository.deleteManyByIds(uniqueIds);
    await syncPlanDiscountFields(planNames);
    return { deleted: uniqueIds.length };
  }
}

module.exports = new DiscountService();
