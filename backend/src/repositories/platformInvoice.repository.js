const { PlatformInvoice, Payment } = require('@models');

class PlatformInvoiceRepository {
  async upsertByInvoiceNumber(invoiceNumber, data) {
    const number = String(invoiceNumber || '')
      .trim()
      .toUpperCase();
    if (!number) return null;

    return PlatformInvoice.findOneAndUpdate(
      { invoiceNumber: number },
      {
        $set: { ...data, invoiceNumber: number, deletedAt: null },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  }

  async findById(id) {
    if (!id) return null;
    return PlatformInvoice.findOne({ _id: id, deletedAt: null }).lean();
  }

  async softDeleteById(id) {
    if (!id) return null;
    return PlatformInvoice.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    ).lean();
  }

  async softDeleteManyByIds(ids = []) {
    const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!uniqueIds.length) return { deletedCount: 0 };
    const result = await PlatformInvoice.updateMany(
      { _id: { $in: uniqueIds }, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );
    return { deletedCount: Number(result?.modifiedCount) || 0 };
  }

  async findByInvoiceNumber(invoiceNumber) {
    const number = String(invoiceNumber || '')
      .trim()
      .toUpperCase();
    if (!number) return null;
    return PlatformInvoice.findOne({ invoiceNumber: number });
  }

  /**
   * Import historical checkout invoices that were stored on Payment only.
   */
  async syncFromPayments() {
    const payments = await Payment.find({
      invoiceNumber: { $nin: [null, ''] },
      status: { $in: ['paid', 'free'] },
    })
      .select(
        'invoiceNumber invoicedAt invoiceEmailed invoiceRecipient customerName customerEmail planName billing currency listAmount discountAmount taxableAmount taxAmount payableAmount taxMode taxLabel discountCode paidAt createdAt'
      )
      .lean();

    if (!payments.length) return { synced: 0 };

    let synced = 0;
    for (const payment of payments) {
      const invoiceNumber = String(payment.invoiceNumber || '')
        .trim()
        .toUpperCase();
      if (!invoiceNumber) continue;

      const existing = await PlatformInvoice.exists({ invoiceNumber });
      if (existing) continue;

      const issuedAt = payment.invoicedAt || payment.paidAt || payment.createdAt || new Date();
      const invoiceDate = issuedAt
        ? new Date(issuedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      await PlatformInvoice.create({
        invoiceNumber,
        invoiceDate,
        source: 'payment',
        payment: payment._id,
        clientName: payment.customerName || '',
        clientEmail: payment.customerEmail || '',
        shopName: payment.customerName || '',
        planName: payment.planName || '',
        billing: payment.billing || '',
        currency: payment.currency || 'INR',
        listAmount: Number(payment.listAmount) || 0,
        discountAmount: Number(payment.discountAmount) || 0,
        taxableAmount: Number(payment.taxableAmount) || 0,
        taxAmount: Number(payment.taxAmount) || 0,
        total: Number(payment.payableAmount) || 0,
        taxMode: payment.taxMode || null,
        taxLabel: payment.taxLabel || '',
        discountCode: payment.discountCode || '',
        emailed: Boolean(payment.invoiceEmailed),
        recipient: payment.invoiceRecipient || payment.customerEmail || null,
        issuedAt,
      });
      synced += 1;
    }

    return { synced };
  }

  buildListFilter({
    search = '',
    source = '',
    planName = '',
    discountCode = '',
    billing = '',
    emailed = '',
    dateFrom = '',
    dateTo = '',
  } = {}) {
    const filter = { deletedAt: null };

    if (source === 'payment' || source === 'plan_change') {
      filter.source = source;
    }

    const plan = String(planName || '').trim();
    if (plan) {
      filter.planName = new RegExp(`^${plan.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    const code = String(discountCode || '')
      .trim()
      .toUpperCase();
    if (code === '__NONE__') {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { discountCode: null },
            { discountCode: '' },
            { discountCode: { $exists: false } },
          ],
        },
      ];
    } else if (code) {
      filter.discountCode = code;
    }

    const cycle = String(billing || '').trim();
    if (cycle) {
      filter.billing = new RegExp(`^${cycle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    if (emailed === 'true' || emailed === true) {
      filter.emailed = true;
    } else if (emailed === 'false' || emailed === false) {
      filter.emailed = false;
    }

    const from = String(dateFrom || '').trim();
    const to = String(dateTo || '').trim();
    if (from || to) {
      filter.issuedAt = {};
      if (from) {
        const start = new Date(`${from}T00:00:00.000Z`);
        if (!Number.isNaN(start.getTime())) filter.issuedAt.$gte = start;
      }
      if (to) {
        const end = new Date(`${to}T23:59:59.999Z`);
        if (!Number.isNaN(end.getTime())) filter.issuedAt.$lte = end;
      }
      if (!Object.keys(filter.issuedAt).length) delete filter.issuedAt;
    }

    const q = String(search || '').trim();
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { invoiceNumber: regex },
        { clientName: regex },
        { clientEmail: regex },
        { shopName: regex },
        { planName: regex },
        { recipient: regex },
        { discountCode: regex },
      ];
    }

    return filter;
  }

  async list({
    page = 1,
    limit = 10,
    search = '',
    source = '',
    planName = '',
    discountCode = '',
    billing = '',
    emailed = '',
    dateFrom = '',
    dateTo = '',
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;
    const filter = this.buildListFilter({
      search,
      source,
      planName,
      discountCode,
      billing,
      emailed,
      dateFrom,
      dateTo,
    });

    const [rows, total] = await Promise.all([
      PlatformInvoice.find(filter)
        .sort({ issuedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      PlatformInvoice.countDocuments(filter),
    ]);

    return {
      invoices: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.max(1, Math.ceil(total / safeLimit) || 1),
      },
    };
  }

  async filterOptions() {
    const active = { deletedAt: null };
    const [plans, coupons, billings] = await Promise.all([
      PlatformInvoice.distinct('planName', {
        ...active,
        planName: { $nin: [null, ''] },
      }),
      PlatformInvoice.distinct('discountCode', {
        ...active,
        discountCode: { $nin: [null, ''] },
      }),
      PlatformInvoice.distinct('billing', {
        ...active,
        billing: { $nin: [null, ''] },
      }),
    ]);

    return {
      plans: (plans || []).map(String).filter(Boolean).sort((a, b) => a.localeCompare(b)),
      coupons: (coupons || [])
        .map((code) => String(code || '').trim().toUpperCase())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
      billings: (billings || []).map(String).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    };
  }

  async stats() {
    const active = { deletedAt: null };
    const [totalInvoices, emailed, paymentSource, planChangeSource, totals] = await Promise.all([
      PlatformInvoice.countDocuments(active),
      PlatformInvoice.countDocuments({ ...active, emailed: true }),
      PlatformInvoice.countDocuments({ ...active, source: 'payment' }),
      PlatformInvoice.countDocuments({ ...active, source: 'plan_change' }),
      PlatformInvoice.aggregate([
        { $match: active },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $ifNull: ['$total', 0] } },
          },
        },
      ]),
    ]);

    return {
      totalInvoices,
      emailed,
      paymentSource,
      planChangeSource,
      revenue: Number(totals?.[0]?.revenue) || 0,
    };
  }
}

module.exports = new PlatformInvoiceRepository();
