const { PlatformQr } = require('@models');

function toView(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: String(plain._id),
    title: plain.title,
    url: plain.url,
    note: plain.note || '',
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

class PlatformQrRepository {
  toView(doc) {
    return toView(doc);
  }

  async create(data) {
    const created = await PlatformQr.create(data);
    return this.toView(created);
  }

  async findById(id) {
    const doc = await PlatformQr.findById(id);
    return this.toView(doc);
  }

  async findAll({ search = '', page = 1, limit = 50 } = {}) {
    const query = {};
    const q = String(search || '').trim();
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { url: regex }, { note: regex }];
    }

    const skip = (Math.max(1, Number(page) || 1) - 1) * Math.min(100, Math.max(1, Number(limit) || 50));
    const take = Math.min(100, Math.max(1, Number(limit) || 50));

    const [rows, total] = await Promise.all([
      PlatformQr.find(query).sort('-createdAt').skip(skip).limit(take),
      PlatformQr.countDocuments(query),
    ]);

    return {
      items: rows.map((row) => this.toView(row)),
      pagination: {
        page: Math.max(1, Number(page) || 1),
        limit: take,
        total,
        pages: Math.max(1, Math.ceil(total / take) || 1),
      },
    };
  }

  async updateById(id, data) {
    const doc = await PlatformQr.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
    return this.toView(doc);
  }

  async deleteById(id) {
    return PlatformQr.findByIdAndDelete(id);
  }
}

module.exports = new PlatformQrRepository();
