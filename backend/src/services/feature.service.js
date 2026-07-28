const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const FeatureRepository = require('@repositories/feature.repository');
const { normalizeFeaturePayload, toFeatureView } = require('@helpers/feature.helper');

class FeatureService {
  async create(body) {
    const data = normalizeFeaturePayload(body);
    if (!data.name) throw new AppError('Feature name is required', HTTP_STATUS.BAD_REQUEST);
    if (!data.code) throw new AppError('Feature code is required', HTTP_STATUS.BAD_REQUEST);

    const existing = await FeatureRepository.findByCode(data.code);
    if (existing) throw new AppError('Feature code already exists', HTTP_STATUS.CONFLICT);

    const feature = await FeatureRepository.create(data);
    return toFeatureView(feature);
  }

  async getAll(query = {}) {
    const { page, limit, search, status } = query;
    const filter = {};
    if (status) {
      filter.status = status === 'disabled' ? 'Disabled' : status === 'enabled' ? 'Enabled' : status;
    }

    const result = await FeatureRepository.findAll(filter, {
      page: Number(page) || 1,
      limit: Number(limit) || 200,
      search: search || '',
    });

    return {
      features: result.features.map(toFeatureView),
      pagination: result.pagination,
    };
  }

  async getById(id) {
    const feature = await FeatureRepository.findById(id);
    if (!feature) throw new AppError('Feature not found', HTTP_STATUS.NOT_FOUND);
    return toFeatureView(feature);
  }

  async update(id, body) {
    const existing = await FeatureRepository.findById(id);
    if (!existing) throw new AppError('Feature not found', HTTP_STATUS.NOT_FOUND);

    const current = existing.toObject();
    const merged = {
      name: body.name !== undefined ? body.name : current.name,
      code: body.code !== undefined ? body.code : current.code,
      category: body.category !== undefined ? body.category : current.category,
      description: body.description !== undefined ? body.description : current.description,
      timesUsed: body.timesUsed !== undefined ? body.timesUsed : current.timesUsed,
      status: body.status !== undefined ? body.status : current.status,
    };

    const data = normalizeFeaturePayload(merged);

    if (body.code && data.code !== current.code) {
      const conflict = await FeatureRepository.findByCode(data.code);
      if (conflict) throw new AppError('Feature code already exists', HTTP_STATUS.CONFLICT);
    }

    const updated = await FeatureRepository.updateById(id, data);
    return toFeatureView(updated);
  }

  async remove(id) {
    const feature = await FeatureRepository.deleteById(id);
    if (!feature) throw new AppError('Feature not found', HTTP_STATUS.NOT_FOUND);
    return toFeatureView(feature);
  }

  async removeMany(ids = []) {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];
    if (!uniqueIds.length) throw new AppError('No features selected', HTTP_STATUS.BAD_REQUEST);
    await FeatureRepository.deleteManyByIds(uniqueIds);
    return { deleted: uniqueIds.length };
  }
}

module.exports = new FeatureService();
