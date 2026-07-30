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
    /** Snapshot of payout details used for this redeem */
    accountHolderName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    accountNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: 32,
    },
    ifsc: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: 20,
    },
    bankName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    upiId: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 120,
    },
    payoutMethod: {
      type: String,
      enum: ['bank', 'upi', 'both', ''],
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'rejected'],
      default: 'pending',
      index: true,
    },
    decisionNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },  {
    timestamps: true,
  }
);

affiliateRedeemSchema.index({ affiliateUser: 1, redeemedAt: -1 });
affiliateRedeemSchema.index({ redeemedAt: -1 });

module.exports = mongoose.model('AffiliateRedeem', affiliateRedeemSchema);
