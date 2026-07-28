const mongoose = require('mongoose');

const typeConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    /** Partner coupon discount % auto-created on approve */
    defaultDiscountPercent: { type: Number, default: 20, min: 0, max: 100 },
    /** % of plan list price credited to the affiliate per referred sale */
    earningPercent: { type: Number, default: 20, min: 0, max: 100 },
    /** Minimum earning total (INR) required before Redeem unlocks */
    minimumTargetValue: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const affiliateSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'platform',
      unique: true,
    },
    /** Payout / target evaluation cycle */
    paymentCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly',
    },
    types: {
      student: { type: typeConfigSchema, default: () => ({}) },
      social_media_creator: { type: typeConfigSchema, default: () => ({}) },
      freelancer_digital_marketer: { type: typeConfigSchema, default: () => ({}) },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AffiliateSettings', affiliateSettingsSchema);
