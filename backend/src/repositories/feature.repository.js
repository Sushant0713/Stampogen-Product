const { Feature } = require('@models');

class FeatureRepository {
  async findById(id) {
    return Feature.findById(id);
  }

  async findByCode(code) {
    return Feature.findOne({ code: String(code).toLowerCase() });
  }

  async create(data) {
    return Feature.create(data);
  }

  async updateById(id, data) {
    return Feature.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return Feature.findByIdAndDelete(id);
  }

  async deleteManyByIds(ids = []) {
    return Feature.deleteMany({ _id: { $in: ids } });
  }

  async findAll(filter = {}, options = {}) {
    const { page = 1, limit = 200, sort = '-createdAt', search = '' } = options;
    const skip = (page - 1) * limit;
    const query = { ...filter };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [features, total] = await Promise.all([
      Feature.find(query).sort(sort).skip(skip).limit(limit),
      Feature.countDocuments(query),
    ]);

    return {
      features,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit) || 1),
      },
    };
  }
}

module.exports = new FeatureRepository();
