const { Payment } = require('@models');

class PaymentRepository {
  async create(data) {
    return Payment.create(data);
  }

  async findById(id) {
    return Payment.findById(id);
  }

  async findByOrderId(orderId) {
    return Payment.findOne({ razorpayOrderId: orderId });
  }

  async updateById(id, data) {
    return Payment.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  /** Remove all checkout payments for a customer email (used when SA deletes a client). */
  async deleteByCustomerEmail(email) {
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized) return { deletedCount: 0 };
    const result = await Payment.deleteMany({ customerEmail: normalized });
    return { deletedCount: Number(result?.deletedCount) || 0 };
  }

  /** Successful checkouts for a customer (used to limit Partner discount to first payment). */
  async countSuccessfulByCustomerEmail(email) {
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized) return 0;
    return Payment.countDocuments({
      customerEmail: normalized,
      status: { $in: ['paid', 'free'] },
    });
  }

  /**
   * Aggregate paid/free checkout revenue + coupons by customer email.
   * Revenue is ex-GST (list − discount), not the Razorpay GST-inclusive total.
   */
  async summarizeByCustomerEmails(emails = []) {
    const list = [
      ...new Set(
        (emails || [])
          .map((email) => String(email || '').trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
    if (!list.length) return new Map();

    // Always ex-GST: list − discount (same as taxableAmount on GST checkouts)
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

    const rows = await Payment.aggregate([
      {
        $match: {
          customerEmail: { $in: list },
          status: { $in: ['paid', 'free'] },
        },
      },
      { $sort: { paidAt: -1, createdAt: -1 } },
      {
        $addFields: {
          revenueLine: taxableExpr,
        },
      },
      {
        $group: {
          _id: '$customerEmail',
          revenue: { $sum: '$revenueLine' },
          listTotal: { $sum: { $ifNull: ['$listAmount', 0] } },
          discountTotal: { $sum: { $ifNull: ['$discountAmount', 0] } },
          paymentCount: { $sum: 1 },
          discountCodes: { $addToSet: '$discountCode' },
          latestDiscountCode: { $first: '$discountCode' },
          latestDiscountAmount: { $first: '$discountAmount' },
          latestListAmount: { $first: '$listAmount' },
          latestPayableAmount: { $first: '$revenueLine' },
        },
      },
    ]);

    const map = new Map();
    for (const row of rows) {
      const codes = (row.discountCodes || [])
        .map((code) => String(code || '').trim().toUpperCase())
        .filter(Boolean);
      map.set(String(row._id).toLowerCase(), {
        revenue: Number(row.revenue) || 0,
        listTotal: Number(row.listTotal) || 0,
        discountTotal: Number(row.discountTotal) || 0,
        paymentCount: Number(row.paymentCount) || 0,
        discountCodes: codes,
        discountCode: String(row.latestDiscountCode || codes[0] || '')
          .trim()
          .toUpperCase(),
        latestDiscountAmount: Number(row.latestDiscountAmount) || 0,
        latestListAmount: Number(row.latestListAmount) || 0,
        latestPayableAmount: Number(row.latestPayableAmount) || 0,
      });
    }
    return map;
  }
}

module.exports = new PaymentRepository();
