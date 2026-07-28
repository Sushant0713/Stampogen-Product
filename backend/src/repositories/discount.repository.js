const { Discount } = require('@models');

class DiscountRepository {
  async findById(id) {
    return Discount.findById(id);
  }

  async findByCode(code) {
    return Discount.findOne({ code: String(code).toUpperCase() });
  }

  async incrementUsageByCode(code) {
    const normalized = String(code || '').toUpperCase();
    // Atomic: do not increment past maxUses (blocks the N+1st concurrent redeem)
    return Discount.findOneAndUpdate(
      {
        code: normalized,
        $or: [{ maxUses: null }, { $expr: { $lt: ['$usageUsed', '$maxUses'] } }],
      },
      { $inc: { usageUsed: 1 } },
      { new: true }
    );
  }

  async findByIds(ids = []) {
    return Discount.find({ _id: { $in: ids } });
  }

  async findBySpecificPlan(planName) {
    return Discount.find({ specificPlan: String(planName || '').trim() }).sort('-createdAt');
  }

  async create(data) {
    return Discount.create(data);
  }

  async updateById(id, data) {
    return Discount.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return Discount.findByIdAndDelete(id);
  }

  async deleteManyByIds(ids = []) {
    return Discount.deleteMany({ _id: { $in: ids } });
  }

  async findAll(filter = {}, options = {}) {
    const { page = 1, limit = 50, sort = '-createdAt', search = '' } = options;
    const skip = (page - 1) * limit;
    const query = { ...filter };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
      ];
    }

    const [discounts, total] = await Promise.all([
      Discount.find(query).sort(sort).skip(skip).limit(limit),
      Discount.countDocuments(query),
    ]);

    return {
      discounts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit) || 1),
      },
    };
  }

  async getStats() {
    const discounts = await Discount.find().select(
      'enabled startDate endDate usageUsed'
    );
    const now = new Date();

    let active = 0;
    let scheduled = 0;
    let ended = 0;
    let disabled = 0;
    let redeemed = 0;

    discounts.forEach((item) => {
      redeemed += Number(item.usageUsed) || 0;

      if (!item.enabled) {
        disabled += 1;
        return;
      }

      const start = item.startDate ? new Date(item.startDate) : null;
      const end = item.endDate ? new Date(item.endDate) : null;

      if (start && start > now) {
        scheduled += 1;
      } else if (end && end < now) {
        ended += 1;
      } else {
        active += 1;
      }
    });

    return {
      total: discounts.length,
      active,
      scheduled,
      ended,
      disabled,
      redeemed,
    };
  }
}

module.exports = new DiscountRepository();
