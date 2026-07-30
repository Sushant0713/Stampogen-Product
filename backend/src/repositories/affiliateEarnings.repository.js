const mongoose = require('mongoose');
const { Payment, AffiliateRedeem } = require('@models');

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

class AffiliateEarningsRepository {
  /** Sum of client taxable revenue (list − discount) for this affiliate coupon. */
  async sumAttributedPayments({ discountCode }) {
    const code = String(discountCode || '')
      .trim()
      .toUpperCase();
    if (!code) return { revenue: 0, paymentCount: 0 };

    const taxableExpr = {
      $max: [
        0,
        {
          $subtract: [
            { $ifNull: ['$listAmount', 0] },
            { $ifNull: ['$discountAmount', 0] },
          ],
        },
      ],
    };

    const [row] = await Payment.aggregate([
      {
        $match: {
          status: { $in: ['paid', 'free'] },
          $expr: {
            $eq: [{ $toUpper: { $ifNull: ['$discountCode', ''] } }, code],
          },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: taxableExpr },
          paymentCount: { $sum: 1 },
        },
      },
    ]);

    return {
      revenue: Number(row?.revenue) || 0,
      paymentCount: Number(row?.paymentCount) || 0,
    };
  }

  /**
   * Recent client checkouts that used this coupon (for dashboard breakdown).
   * Optionally skip payments already covered by redeems by returning newest first
   * and letting the service slice by remaining current total.
   */
  async listAttributedPayments({ discountCode, limit = 40 } = {}) {
    const code = String(discountCode || '')
      .trim()
      .toUpperCase();
    if (!code) return [];

    const rows = await Payment.find({
      status: { $in: ['paid', 'free'] },
      discountCode: code,
    })
      .select(
        'customerName customerEmail payableAmount listAmount discountAmount taxableAmount discountCode paidAt createdAt planName status'
      )
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // Fallback case-insensitive if stored casing differs
    if (rows.length) return rows;

    return Payment.find({
      status: { $in: ['paid', 'free'] },
    })
      .select(
        'customerName customerEmail payableAmount listAmount discountAmount taxableAmount discountCode paidAt createdAt planName status'
      )
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(200)
      .lean()
      .then((all) =>
        all
          .filter(
            (p) => String(p.discountCode || '').trim().toUpperCase() === code
          )
          .slice(0, limit)
      );
  }

  async sumRedeems(affiliateUserId) {
    const oid = toObjectId(affiliateUserId);
    if (!oid) {
      return { totalRedeemed: 0, redeemCount: 0, lastRedeemedAt: null };
    }

    const [row] = await AffiliateRedeem.aggregate([
      {
        $match: {
          affiliateUser: oid,
          // Rejected redeems unlock the amount back into current total
          status: { $in: ['pending', 'paid'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$amount', 0] } },
          count: { $sum: 1 },
          lastRedeemedAt: { $max: '$redeemedAt' },
        },
      },
    ]);

    return {
      totalRedeemed: Number(row?.total) || 0,
      redeemCount: Number(row?.count) || 0,
      lastRedeemedAt: row?.lastRedeemedAt || null,
    };
  }

  async createRedeem(data) {
    return AffiliateRedeem.create(data);
  }

  async listRedeems(affiliateUserId, { limit = 20 } = {}) {
    const oid = toObjectId(affiliateUserId);
    if (!oid) return [];
    return AffiliateRedeem.find({ affiliateUser: oid })
      .sort({ redeemedAt: -1 })
      .limit(limit)
      .lean();
  }

  async listAllRedeems({ page = 1, limit = 20, status = '' } = {}) {
    const filter = {};
    if (status === 'pending' || status === 'paid' || status === 'rejected') {
      filter.status = status;
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * lim;

    const [rows, total] = await Promise.all([
      AffiliateRedeem.find(filter)
        .populate({
          path: 'affiliateUser',
          select:
            'firstName middleName lastName email phone affiliateType affiliateDiscountCode',
        })
        .sort({ redeemedAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      AffiliateRedeem.countDocuments(filter),
    ]);

    return { rows, total, page: pageNum, limit: lim };
  }

  async countRedeemsByStatus(status = 'pending') {
    if (status !== 'pending' && status !== 'paid' && status !== 'rejected') {
      return 0;
    }
    return AffiliateRedeem.countDocuments({ status });
  }

  async findRedeemById(id) {
    const oid = toObjectId(id);
    if (!oid) return null;
    return AffiliateRedeem.findById(oid)
      .populate({
        path: 'affiliateUser',
        select:
          'firstName middleName lastName email phone affiliateType affiliateDiscountCode',
      })
      .lean();
  }

  async updateRedeemById(id, data) {
    const oid = toObjectId(id);
    if (!oid) return null;
    return AffiliateRedeem.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate({
        path: 'affiliateUser',
        select:
          'firstName middleName lastName email phone affiliateType affiliateDiscountCode',
      })
      .lean();
  }

  /**
   * Group attributed paid/free checkouts by customer email for portfolio view.
   * Revenue totals are ex-GST (list − discount).
   */
  async groupClientsByDiscountCode(discountCode) {
    const code = String(discountCode || '')
      .trim()
      .toUpperCase();
    if (!code) return [];

    const taxableExpr = {
      $max: [
        0,
        {
          $subtract: [
            { $ifNull: ['$listAmount', 0] },
            { $ifNull: ['$discountAmount', 0] },
          ],
        },
      ],
    };

    return Payment.aggregate([
      {
        $match: {
          status: { $in: ['paid', 'free'] },
          $expr: {
            $eq: [{ $toUpper: { $ifNull: ['$discountCode', ''] } }, code],
          },
        },
      },
      { $sort: { paidAt: -1, createdAt: -1 } },
      {
        $group: {
          _id: { $toLower: { $ifNull: ['$customerEmail', ''] } },
          customerEmail: { $first: '$customerEmail' },
          customerName: { $first: '$customerName' },
          planName: { $first: '$planName' },
          discountCode: { $first: '$discountCode' },
          paymentCount: { $sum: 1 },
          listTotal: { $sum: { $ifNull: ['$listAmount', 0] } },
          discountTotal: { $sum: { $ifNull: ['$discountAmount', 0] } },
          taxableTotal: { $sum: taxableExpr },
          payableTotal: { $sum: { $ifNull: ['$payableAmount', 0] } },
          firstPaidAt: { $min: { $ifNull: ['$paidAt', '$createdAt'] } },
          lastPaidAt: { $max: { $ifNull: ['$paidAt', '$createdAt'] } },
        },
      },
      { $match: { _id: { $ne: '' } } },
      { $sort: { lastPaidAt: -1 } },
    ]);
  }
}

module.exports = new AffiliateEarningsRepository();
