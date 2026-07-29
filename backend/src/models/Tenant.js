const mongoose = require('mongoose');
const { TENANT_STATUS, LOYALTY_STAMP_MODES, LOYALTY_STAMP_MODE_VALUES, SHOP_CATEGORY_VALUES } = require('@constants');

const loyaltyOfferSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    stampsRequired: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      default: 5,
    },
    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active',
    },
    color: {
      type: String,
      trim: true,
      default: '#3B82F6',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    startDate: {
      type: Date,
      default: null,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** null = unlimited customers */
    maxCustomers: {
      type: Number,
      default: null,
      min: 1,
    },
  },
  { _id: false }
);

const billingSegmentSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    pricePerCycle: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    cycles: {
      type: Number,
      default: 0,
      min: 0,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TENANT_STATUS),
      default: TENANT_STATUS.PENDING,
    },
    /** Collected at admin registration — used on platform invoices (Bill To). */
    billingProfile: {
      phone: { type: String, trim: true, default: '' },
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      pin: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      gstin: { type: String, trim: true, uppercase: true, default: '' },
      pan: { type: String, trim: true, uppercase: true, default: '' },
    },
    currentPlan: {
      name: { type: String, default: null },
      pricePerCycle: { type: Number, default: 0 },
      startedAt: { type: Date, default: null },
      /** Matches Plan.billing — used to compute renew / remaining days */
      billing: {
        type: String,
        enum: ['Monthly', 'Yearly', 'Custom', null],
        default: null,
      },
      endsAt: { type: Date, default: null },
    },
    /**
     * Purchased plan waiting until currentPlan.endsAt.
     * Applied automatically on login /me / next payment when startsAt is due.
     */
    pendingPlan: {
      name: { type: String, default: null },
      pricePerCycle: { type: Number, default: 0 },
      billing: {
        type: String,
        enum: ['Monthly', 'Yearly', 'Custom', null],
        default: null,
      },
      startsAt: { type: Date, default: null },
      endsAt: { type: Date, default: null },
      purchasedAt: { type: Date, default: null },
    },
    billingHistory: {
      type: [billingSegmentSchema],
      default: [],
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    /** Shop loyalty campaign catalog — customers earn stamps per offer. */
    loyaltyOffers: {
      type: [loyaltyOfferSchema],
      default: [],
    },
    /** How customers earn stamps: bill photo or admin-approved request. */
    loyaltyStampMode: {
      type: String,
      enum: LOYALTY_STAMP_MODE_VALUES,
      default: LOYALTY_STAMP_MODES.BILL,
    },
    /** Business category selected during admin registration. */
    category: {
      type: String,
      enum: SHOP_CATEGORY_VALUES,
      required: false,
      index: true,
    },
    /** Free-text category when category is `custom`. */
    customCategory: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    /**
     * Loyalty QR scan counters for the current calendar month (Asia/Kolkata).
     * Automatically reset when the month rolls over.
     */
    loyaltyQrScanMonth: {
      type: String,
      trim: true,
      default: '',
      maxlength: 7,
    },
    /** Map of YYYY-MM-DD → scan count for loyaltyQrScanMonth only. */
    loyaltyQrScansByDay: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    /** Public social / review links shown on customer loyalty cards. */
    socialLinks: {
      facebook: { type: String, trim: true, maxlength: 500, default: '' },
      instagram: { type: String, trim: true, maxlength: 500, default: '' },
      x: { type: String, trim: true, maxlength: 500, default: '' },
      youtube: { type: String, trim: true, maxlength: 500, default: '' },
      whatsapp: { type: String, trim: true, maxlength: 500, default: '' },
      googleReview: { type: String, trim: true, maxlength: 500, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

tenantSchema.index({ owner: 1 });
tenantSchema.index({ status: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
