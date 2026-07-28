const { Plan } = require('@models');

class PlanRepository {
  async findById(id) {
    return Plan.findById(id).populate('features');
  }

  async findByCode(code) {
    return Plan.findOne({ code: String(code).toLowerCase() }).populate('features');
  }

  async findByName(name) {
    const value = String(name || '').trim();
    if (!value) return null;
    return Plan.findOne({ name: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).populate(
      'features'
    );
  }

  async create(data) {
    const plan = await Plan.create(data);
    return this.findById(plan._id);
  }

  async updateById(id, data) {
    await Plan.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    return this.findById(id);
  }

  async deleteById(id) {
    return Plan.findByIdAndDelete(id);
  }

  async deleteManyByIds(ids = []) {
    return Plan.deleteMany({ _id: { $in: ids } });
  }

  async findAll(filter = {}, options = {}) {
    const { page = 1, limit = 200, sort = '-createdAt', search = '' } = options;
    const skip = (page - 1) * limit;
    const query = { ...filter };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { billing: { $regex: search, $options: 'i' } },
        { discountCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [plans, total] = await Promise.all([
      Plan.find(query).populate('features').sort(sort).skip(skip).limit(limit),
      Plan.countDocuments(query),
    ]);

    return {
      plans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit) || 1),
      },
    };
  }
}

module.exports = new PlanRepository();
