const mongoose = require('mongoose');

const platformTrialSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'platform',
      unique: true,
    },
    /** Master switch for platform free trials. */
    enabled: {
      type: Boolean,
      default: false,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },
    planCode: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    trialDays: {
      type: Number,
      default: 14,
      min: 1,
      max: 3650,
    },
    /** When true, verified public admin signup can start this trial without Razorpay. */
    applyOnPublicSignup: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformTrialSettings', platformTrialSettingsSchema);
