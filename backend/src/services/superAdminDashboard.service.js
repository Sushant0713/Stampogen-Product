const {
  Tenant,
  Payment,
  PlatformInvoice,
  Discount,
  AffiliateRedeem,
  User,
  Role,
} = require('@models');
const { TENANT_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');

const ALLOWED_PERIODS = new Set([7, 30, 90, 365]);

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function percentChange(current, previous) {
  const now = Number(current) || 0;
  const before = Number(previous) || 0;
  if (before === 0) return now > 0 ? 100 : 0;
  return Math.round(((now - before) / before) * 1000) / 10;
}

function startOfUtcDay(value = new Date()) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addUtcDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function parseDateInput(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveRange({ periodInput = 30, fromInput = '', toInput = '' } = {}) {
  const now = new Date();
  let start = parseDateInput(fromInput);
  let endInclusive = parseDateInput(toInput);

  if (start && endInclusive && start > endInclusive) {
    const swap = start;
    start = endInclusive;
    endInclusive = swap;
  }

  if (start || endInclusive) {
    if (!start) start = addUtcDays(endInclusive || startOfUtcDay(now), -29);
    if (!endInclusive) endInclusive = startOfUtcDay(now);
    // Cap custom ranges at 2 years
    const maxSpanMs = 366 * 2 * 24 * 60 * 60 * 1000;
    if (endInclusive.getTime() - start.getTime() > maxSpanMs) {
      start = addUtcDays(endInclusive, -(366 * 2 - 1));
    }
    const endExclusive = addUtcDays(startOfUtcDay(endInclusive), 1);
    const days = Math.max(
      1,
      Math.round((endExclusive.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    );
    return {
      start,
      end: endExclusive,
      days,
      monthly: days > 120,
      mode: 'custom',
      from: start.toISOString().slice(0, 10),
      to: endInclusive.toISOString().slice(0, 10),
    };
  }

  const requested = Number(periodInput) || 30;
  const period = ALLOWED_PERIODS.has(requested) ? requested : 30;
  const end = addUtcDays(startOfUtcDay(now), 1);
  const rangeStart = addUtcDays(end, -period);
  return {
    start: rangeStart,
    end,
    days: period,
    monthly: period === 365,
    mode: 'period',
    from: rangeStart.toISOString().slice(0, 10),
    to: startOfUtcDay(now).toISOString().slice(0, 10),
  };
}

function dateKey(value, monthly = false) {
  const iso = new Date(value).toISOString();
  return monthly ? iso.slice(0, 7) : iso.slice(0, 10);
}

function fillSeries(rows, start, end, { monthly = false, valueFields = [] } = {}) {
  const byKey = new Map((rows || []).map((row) => [String(row._id), row]));
  const result = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const key = dateKey(cursor, monthly);
    const source = byKey.get(key) || {};
    const point = { date: key };
    for (const field of valueFields) {
      point[field] = roundMoney(source[field] || 0);
    }
    result.push(point);

    if (monthly) {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return result;
}

async function successfulPaymentSummary(start, end) {
  const rows = await Payment.aggregate([
    { $match: { status: { $in: ['paid', 'free'] } } },
    { $addFields: { eventDate: { $ifNull: ['$paidAt', '$createdAt'] } } },
    { $match: { eventDate: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: null,
        revenue: {
          $sum: {
            $max: [
              0,
              {
                $ifNull: [
                  '$taxableAmount',
                  {
                    $subtract: [
                      { $ifNull: ['$listAmount', 0] },
                      { $ifNull: ['$discountAmount', 0] },
                    ],
                  },
                ],
              },
            ],
          },
        },
        collected: { $sum: { $ifNull: ['$payableAmount', 0] } },
        tax: { $sum: { $ifNull: ['$taxAmount', 0] } },
        discounts: { $sum: { $ifNull: ['$discountAmount', 0] } },
        payments: { $sum: 1 },
        clients: { $addToSet: '$customerEmail' },
      },
    },
  ]);

  const row = rows[0] || {};
  return {
    revenue: roundMoney(row.revenue),
    collected: roundMoney(row.collected),
    tax: roundMoney(row.tax),
    discounts: roundMoney(row.discounts),
    payments: Number(row.payments) || 0,
    payingClients: (row.clients || []).filter(Boolean).length,
  };
}

async function revenueTrend(start, end, monthly) {
  const format = monthly ? '%Y-%m' : '%Y-%m-%d';
  const rows = await Payment.aggregate([
    { $match: { status: { $in: ['paid', 'free'] } } },
    { $addFields: { eventDate: { $ifNull: ['$paidAt', '$createdAt'] } } },
    { $match: { eventDate: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $dateToString: { format, date: '$eventDate', timezone: 'UTC' } },
        revenue: {
          $sum: {
            $max: [
              0,
              {
                $ifNull: [
                  '$taxableAmount',
                  {
                    $subtract: [
                      { $ifNull: ['$listAmount', 0] },
                      { $ifNull: ['$discountAmount', 0] },
                    ],
                  },
                ],
              },
            ],
          },
        },
        collected: { $sum: { $ifNull: ['$payableAmount', 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return fillSeries(rows, start, addUtcDays(end, -1), {
    monthly,
    valueFields: ['revenue', 'collected'],
  });
}

async function clientGrowth(start, end, monthly) {
  const format = monthly ? '%Y-%m' : '%Y-%m-%d';
  const rows = await Tenant.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $dateToString: { format, date: '$createdAt', timezone: 'UTC' } },
        clients: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return fillSeries(rows, start, addUtcDays(end, -1), {
    monthly,
    valueFields: ['clients'],
  });
}

class SuperAdminDashboardService {
  async get({ period: periodInput = 30, from: fromInput = '', to: toInput = '' } = {}) {
    const now = new Date();
    const range = resolveRange({ periodInput, fromInput, toInput });
    const { start, end, days: period, monthly } = range;
    const previousStart = addUtcDays(start, -period);
    const riskWindowEnd = addUtcDays(now, 14);

    const affiliateRole = await Role.findOne({ slug: ROLES.AFFILIATE }).select('_id').lean();
    const approvedAffiliateFilter = affiliateRole
      ? {
          role: affiliateRole._id,
          $or: [
            { affiliateApprovalStatus: 'approved' },
            { affiliateApprovalStatus: null },
            { affiliateApprovalStatus: { $exists: false } },
          ],
        }
      : { _id: null };
    const pendingAffiliateFilter = affiliateRole
      ? { role: affiliateRole._id, affiliateApprovalStatus: 'pending' }
      : { _id: null };

    const [
      currentPayments,
      previousPayments,
      revenueSeries,
      clientSeries,
      totalClients,
      activeClients,
      suspendedClients,
      newClients,
      previousNewClients,
      atRiskClients,
      mrrRows,
      planRows,
      paymentStatusRows,
      couponRows,
      totalAffiliates,
      activeAffiliates,
      pendingAffiliates,
      redeemedRows,
      invoiceRows,
      activeDiscounts,
      recentPayments,
      recentClients,
    ] = await Promise.all([
      successfulPaymentSummary(start, end),
      successfulPaymentSummary(previousStart, start),
      revenueTrend(start, end, monthly),
      clientGrowth(start, end, monthly),
      Tenant.countDocuments({}),
      Tenant.countDocuments({ status: TENANT_STATUS.ACTIVE }),
      Tenant.countDocuments({ status: TENANT_STATUS.SUSPENDED }),
      Tenant.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Tenant.countDocuments({ createdAt: { $gte: previousStart, $lt: start } }),
      Tenant.countDocuments({
        status: TENANT_STATUS.ACTIVE,
        'currentPlan.endsAt': { $gte: now, $lte: riskWindowEnd },
      }),
      Tenant.aggregate([
        {
          $match: {
            status: TENANT_STATUS.ACTIVE,
            'currentPlan.name': { $nin: [null, ''] },
            'currentPlan.pricePerCycle': { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            mrr: {
              $sum: {
                $cond: [
                  { $eq: ['$currentPlan.billing', 'Yearly'] },
                  { $divide: ['$currentPlan.pricePerCycle', 12] },
                  '$currentPlan.pricePerCycle',
                ],
              },
            },
            payingClients: { $sum: 1 },
          },
        },
      ]),
      Tenant.aggregate([
        {
          $match: {
            status: TENANT_STATUS.ACTIVE,
            'currentPlan.name': { $nin: [null, ''] },
          },
        },
        { $group: { _id: '$currentPlan.name', clients: { $sum: 1 } } },
        { $sort: { clients: -1, _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            status: { $in: ['paid', 'free'] },
            discountCode: { $nin: [null, ''] },
          },
        },
        { $addFields: { eventDate: { $ifNull: ['$paidAt', '$createdAt'] } } },
        { $match: { eventDate: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: '$discountCode',
            uses: { $sum: 1 },
            discount: { $sum: { $ifNull: ['$discountAmount', 0] } },
            revenue: { $sum: { $ifNull: ['$taxableAmount', 0] } },
          },
        },
        { $sort: { revenue: -1, uses: -1 } },
        { $limit: 5 },
      ]),
      User.countDocuments(approvedAffiliateFilter),
      User.countDocuments({ ...approvedAffiliateFilter, isActive: true }),
      User.countDocuments(pendingAffiliateFilter),
      AffiliateRedeem.aggregate([
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]),
      PlatformInvoice.aggregate([
        { $match: { deletedAt: null } },
        {
          $group: {
            _id: null,
            issued: { $sum: 1 },
            emailed: { $sum: { $cond: ['$emailed', 1, 0] } },
            notEmailed: { $sum: { $cond: ['$emailed', 0, 1] } },
          },
        },
      ]),
      Discount.countDocuments({
        enabled: true,
        $and: [
          { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
          { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
        ],
      }),
      Payment.find({})
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(6)
        .select(
          'customerName customerEmail planName status taxableAmount payableAmount paidAt createdAt discountCode'
        )
        .lean(),
      Tenant.find({})
        .sort({ createdAt: -1 })
        .limit(6)
        .select('name status currentPlan.name createdAt')
        .lean(),
    ]);

    const mrr = mrrRows[0] || {};
    const invoice = invoiceRows[0] || {};
    const redeemed = redeemedRows[0] || {};
    const statusMap = Object.fromEntries(
      paymentStatusRows.map((row) => [String(row._id || 'unknown'), Number(row.count) || 0])
    );

    const recentActivity = [
      ...recentPayments.map((payment) => ({
        id: String(payment._id),
        type: 'payment',
        title:
          payment.status === 'paid' || payment.status === 'free'
            ? `Payment from ${payment.customerName || payment.customerEmail || 'Client'}`
            : `Checkout ${payment.status}`,
        description: `${payment.planName || 'Plan'}${payment.discountCode ? ` · ${payment.discountCode}` : ''}`,
        amount: roundMoney(payment.taxableAmount || payment.payableAmount),
        status: payment.status,
        at: payment.paidAt || payment.createdAt,
      })),
      ...recentClients.map((tenant) => ({
        id: String(tenant._id),
        type: 'client',
        title: `New client: ${tenant.name}`,
        description: tenant.currentPlan?.name || 'No plan selected',
        amount: null,
        status: tenant.status,
        at: tenant.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 8);

    return {
      period: {
        days: period,
        mode: range.mode,
        from: range.from,
        to: range.to,
        generatedAt: now.toISOString(),
      },
      kpis: {
        revenue: currentPayments.revenue,
        revenueChange: percentChange(currentPayments.revenue, previousPayments.revenue),
        mrr: roundMoney(mrr.mrr),
        payingClients: Number(mrr.payingClients) || 0,
        totalClients,
        activeClients,
        suspendedClients,
        newClients,
        clientGrowth: percentChange(newClients, previousNewClients),
        atRiskClients,
        pendingActions:
          pendingAffiliates + (Number(invoice.notEmailed) || 0) + atRiskClients,
      },
      money: {
        collected: currentPayments.collected,
        tax: currentPayments.tax,
        discounts: currentPayments.discounts,
        payments: currentPayments.payments,
      },
      charts: {
        revenue: revenueSeries,
        clients: clientSeries,
        planMix: planRows.map((row) => ({
          name: row._id || 'No plan',
          value: Number(row.clients) || 0,
        })),
        paymentStatus: ['paid', 'free', 'created', 'failed'].map((status) => ({
          name: status,
          value: statusMap[status] || 0,
        })),
      },
      coupons: {
        active: activeDiscounts,
        top: couponRows.map((row) => ({
          code: row._id,
          uses: Number(row.uses) || 0,
          discount: roundMoney(row.discount),
          revenue: roundMoney(row.revenue),
        })),
      },
      affiliates: {
        total: totalAffiliates,
        active: activeAffiliates,
        pending: pendingAffiliates,
        redeemed: roundMoney(redeemed.total),
      },
      invoices: {
        issued: Number(invoice.issued) || 0,
        emailed: Number(invoice.emailed) || 0,
        notEmailed: Number(invoice.notEmailed) || 0,
      },
      recentActivity,
    };
  }
}

module.exports = new SuperAdminDashboardService();
