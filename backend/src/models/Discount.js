const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 40,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ['Simple discount', 'Partner discount', 'One Time Discount'],
      default: 'Simple discount',
    },
    amountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: true,
    },
    amountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    planType: {
      type: String,
      default: 'All plan types',
      trim: true,
    },
    specificPlan: {
      type: String,
      default: 'Any plan',
      trim: true,
    },
    billingCycle: {
      type: String,
      default: 'All billing cycles',
      trim: true,
    },
    minOrderAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    maxUses: {
      type: Number,
      default: null,
      min: 0,
    },
    usageUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    /** Set when auto-created for an approved affiliate partner */
    affiliateUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

discountSchema.index({ enabled: 1 });
discountSchema.index({ type: 1 });
discountSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Discount', discountSchema);
