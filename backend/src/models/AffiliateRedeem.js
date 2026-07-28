const mongoose = require('mongoose');

const affiliateRedeemSchema = new mongoose.Schema(
  {
    affiliateUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    /** Snapshot of attributed revenue at redeem time (for audit) */
    attributedRevenueAtRedeem: {
      type: Number,
      default: 0,
      min: 0,
    },
    minTargetAtRedeem: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

affiliateRedeemSchema.index({ affiliateUser: 1, redeemedAt: -1 });

module.exports = mongoose.model('AffiliateRedeem', affiliateRedeemSchema);
