const crypto = require('crypto');
const { PlatformQr, PlatformQrScan } = require('@models');
const config = require('@config');

function buildScanUrl(code) {
  const base = String(config.frontendUrl || '').replace(/\/$/, '');
  return `${base}/q/${encodeURIComponent(code)}`;
}

function toView(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const code = plain.code || '';
  return {
    id: String(plain._id),
    title: plain.title,
    url: plain.url,
    note: plain.note || '',
    code,
    scanUrl: code ? buildScanUrl(code) : '',
    scanCount: Number(plain.scanCount) || 0,
    lastScannedAt: plain.lastScannedAt || null,
    showToAffiliates: Boolean(plain.showToAffiliates),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateBound(value, end = false) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw.includes('T') ? raw : `${raw}T${end ? '23:59:59.999' : '00:00:00.000'}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

class PlatformQrRepository {
  toView(doc) {
    return toView(doc);
  }

  async generateUniqueCode() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = crypto.randomBytes(5).toString('hex');
      // eslint-disable-next-line no-await-in-loop
      const exists = await PlatformQr.exists({ code });
      if (!exists) return code;
    }
    return crypto.randomBytes(8).toString('hex');
  }

  async ensureCode(doc) {
    if (!doc) return null;
    if (doc.code) return doc;
    const code = await this.generateUniqueCode();
    doc.code = code;
    if (doc.scanCount == null) doc.scanCount = 0;
    await doc.save();
    return doc;
  }

  async create(data) {
    const code = data.code || (await this.generateUniqueCode());
    const created = await PlatformQr.create({
      ...data,
      code,
      scanCount: 0,
      showToAffiliates: Boolean(data.showToAffiliates),
    });
    return this.toView(created);
  }

  async findById(id) {
    const doc = await this.ensureCode(await PlatformQr.findById(id));
    return this.toView(doc);
  }

  async findByCode(code) {
    const normalized = String(code || '')
      .trim()
      .toLowerCase();
    if (!normalized) return null;
    const doc = await PlatformQr.findOne({ code: normalized });
    return doc;
  }

  async findAll({ search = '', page = 1, limit = 50 } = {}) {
    const query = {};
    const q = String(search || '').trim();
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { url: regex }, { note: regex }, { code: regex }];
    }

    const skip = (Math.max(1, Number(page) || 1) - 1) * Math.min(100, Math.max(1, Number(limit) || 50));
    const take = Math.min(100, Math.max(1, Number(limit) || 50));

    const [rows, total] = await Promise.all([
      PlatformQr.find(query).sort('-createdAt').skip(skip).limit(take),
      PlatformQr.countDocuments(query),
    ]);

    const items = [];
    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      items.push(this.toView(await this.ensureCode(row)));
    }

    return {
      items,
      pagination: {
        page: Math.max(1, Number(page) || 1),
        limit: take,
        total,
        pages: Math.max(1, Math.ceil(total / take) || 1),
      },
    };
  }

  async findForAffiliates() {
    const rows = await PlatformQr.find({ showToAffiliates: true }).sort('title');
    const items = [];
    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      items.push(this.toView(await this.ensureCode(row)));
    }
    return { items };
  }

  async updateById(id, data) {
    const doc = await PlatformQr.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
    return this.toView(await this.ensureCode(doc));
  }

  async deleteById(id) {
    const deleted = await PlatformQr.findByIdAndDelete(id);
    if (deleted) {
      await PlatformQrScan.deleteMany({ qr: deleted._id });
    }
    return deleted;
  }

  async recordScan(doc, meta = {}) {
    if (!doc) return null;
    const now = new Date();
    await PlatformQrScan.create({
      qr: doc._id,
      code: doc.code,
      userAgent: String(meta.userAgent || '').slice(0, 500),
      ip: String(meta.ip || '').slice(0, 80),
      referer: String(meta.referer || '').slice(0, 500),
    });
    doc.scanCount = (Number(doc.scanCount) || 0) + 1;
    doc.lastScannedAt = now;
    await doc.save();
    return this.toView(doc);
  }

  async listOptions() {
    const rows = await PlatformQr.find({}).sort('title').select('title code scanCount');
    const items = [];
    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      const ensured = await this.ensureCode(row);
      items.push({
        id: String(ensured._id),
        title: ensured.title,
        code: ensured.code,
        scanCount: Number(ensured.scanCount) || 0,
      });
    }
    return items;
  }

  async getReports({
    from,
    to,
    qrId,
    search = '',
    sort = 'scans',
    minScans = 0,
  } = {}) {
    const fromDate = parseDateBound(from, false);
    const toDate = parseDateBound(to, true);
    const hasRange = Boolean(fromDate || toDate);

    const scanMatch = {};
    if (fromDate || toDate) {
      scanMatch.createdAt = {};
      if (fromDate) scanMatch.createdAt.$gte = fromDate;
      if (toDate) scanMatch.createdAt.$lte = toDate;
    }
    if (qrId) {
      scanMatch.qr = qrId;
    }

    const qrQuery = {};
    if (qrId) qrQuery._id = qrId;
    const q = String(search || '').trim();
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      qrQuery.$or = [{ title: regex }, { url: regex }, { note: regex }, { code: regex }];
    }

    const [qrDocs, rangeAgg, seriesAgg, lifetimeTotal] = await Promise.all([
      PlatformQr.find(qrQuery).sort('-createdAt'),
      PlatformQrScan.aggregate([
        { $match: scanMatch },
        {
          $group: {
            _id: '$qr',
            scansInRange: { $sum: 1 },
            lastScannedAt: { $max: '$createdAt' },
          },
        },
      ]),
      hasRange
        ? PlatformQrScan.aggregate([
            { $match: scanMatch },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                scans: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ])
        : PlatformQrScan.aggregate([
            ...(qrId ? [{ $match: { qr: qrId } }] : []),
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                },
                scans: { $sum: 1 },
              },
            },
            { $sort: { _id: -1 } },
            { $limit: 90 },
            { $sort: { _id: 1 } },
          ]),
      PlatformQrScan.countDocuments(qrId ? { qr: qrId } : {}),
    ]);

    const rangeMap = new Map(
      rangeAgg.map((row) => [String(row._id), row])
    );

    let items = [];
    for (const doc of qrDocs) {
      // eslint-disable-next-line no-await-in-loop
      const ensured = await this.ensureCode(doc);
      const range = rangeMap.get(String(ensured._id));
      const scansInRange = hasRange
        ? Number(range?.scansInRange) || 0
        : Number(ensured.scanCount) || 0;
      items.push({
        ...this.toView(ensured),
        scansInRange,
        lastScannedInRange: range?.lastScannedAt || null,
      });
    }

    const min = Math.max(0, Number(minScans) || 0);
    if (min > 0) {
      items = items.filter((item) => item.scansInRange >= min);
    }

    const sortKey = String(sort || 'scans').toLowerCase();
    items.sort((a, b) => {
      if (sortKey === 'title') return String(a.title).localeCompare(String(b.title));
      if (sortKey === 'recent') {
        const aTime = new Date(a.lastScannedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastScannedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      }
      if (sortKey === 'least') return a.scansInRange - b.scansInRange;
      if (sortKey === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return b.scansInRange - a.scansInRange;
    });

    const totalScansInRange = items.reduce((sum, item) => sum + item.scansInRange, 0);
    const activeQrs = items.filter((item) => item.scansInRange > 0).length;
    const topQr = items[0]?.scansInRange > 0 ? items[0] : null;

    let series = seriesAgg.map((row) => ({
      date: row._id,
      scans: Number(row.scans) || 0,
    }));

    if (hasRange && fromDate && toDate) {
      const filled = [];
      const cursor = startOfDay(fromDate);
      const end = startOfDay(toDate);
      const byDate = new Map(series.map((row) => [row.date, row.scans]));
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        filled.push({ date: key, scans: byDate.get(key) || 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      series = filled;
    }

    return {
      summary: {
        totalScansInRange,
        lifetimeScans: lifetimeTotal,
        qrCount: items.length,
        activeQrs,
        topQr: topQr
          ? {
              id: topQr.id,
              title: topQr.title,
              scans: topQr.scansInRange,
            }
          : null,
      },
      items,
      series,
      filters: {
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
        qrId: qrId ? String(qrId) : null,
        search: q,
        sort: sortKey,
        minScans: min,
      },
    };
  }
}

module.exports = new PlatformQrRepository();
