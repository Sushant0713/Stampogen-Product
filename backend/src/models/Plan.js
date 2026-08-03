const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
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
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    priceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    mrpAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    priceCustom: {
      type: Boolean,
      default: false,
    },
    billing: {
      type: String,
      enum: ['Monthly', 'Yearly', 'Custom'],
      default: 'Monthly',
    },
    features: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Feature',
      },
    ],
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    users: {
      type: Number,
      default: 0,
      min: 0,
    },
    usersUnlimited: {
      type: Boolean,
      default: false,
    },
    discountLinked: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountCode: {
      type: String,
      trim: true,
      default: '',
      maxlength: 40,
    },
    visibleWebsite: {
      type: Boolean,
      default: false,
    },
    visibleSuperAdmin: {
      type: Boolean,
      default: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    ctaText: {
      type: String,
      trim: true,
      default: 'Get early access',
      maxlength: 60,
    },
    /** Show highlight badge + emphasis on /pricing */
    featuredOnWebsite: {
      type: Boolean,
      default: false,
    },
    /** Badge label when featuredOnWebsite is on (e.g. MOST STAMPED, POPULAR) */
    badgeText: {
      type: String,
      trim: true,
      default: 'MOST STAMPED',
      maxlength: 40,
    },
    /**
     * Outlet seat plan — sold to main admins (1 purchase = 1 outlet).
     * Hidden from normal shop pricing; shown under Admin → Outlet plans.
     */
    forOutlet: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

planSchema.index({ status: 1 });
planSchema.index({ enabled: 1 });
planSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Plan', planSchema);
