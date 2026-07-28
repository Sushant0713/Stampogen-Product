const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    document: {
      type: String,
      required: true,
    },
    documentName: {
      type: String,
      trim: true,
      default: 'bill.jpg',
      maxlength: 200,
    },
    offerKey: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },
    offerTitle: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    stampedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const offerProgressSchema = new mongoose.Schema(
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
      maxlength: 120,
    },
    stamps: {
      type: Number,
      default: 0,
      min: 0,
    },
    stampsRequired: {
      type: Number,
      default: 5,
      min: 1,
      max: 50,
    },
    rewardStatus: {
      type: String,
      enum: ['collecting', 'pending', 'verified', 'redeemed', 'rejected'],
      default: 'collecting',
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    redeemedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const stampRequestSchema = new mongoose.Schema(
  {
    offerKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    offerTitle: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

const loyaltyMembershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    /** @deprecated kept for older records — use offers[] */
    stamps: {
      type: Number,
      default: 0,
      min: 0,
    },
    campaignName: {
      type: String,
      trim: true,
      default: 'Loyalty Club',
      maxlength: 120,
    },
    rewardTitle: {
      type: String,
      trim: true,
      default: 'Free Reward',
      maxlength: 120,
    },
    stampsRequired: {
      type: Number,
      default: 5,
      min: 1,
      max: 50,
    },
    offers: {
      type: [offerProgressSchema],
      default: [],
    },
    stampRequests: {
      type: [stampRequestSchema],
      default: [],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastStampAt: {
      type: Date,
      default: null,
    },
    lastOfferTitle: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    lastOfferKey: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },
    lastBillDocumentName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    billCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    bills: {
      type: [billSchema],
      default: [],
      select: false,
    },
    /** @deprecated membership-level status; prefer offers[].rewardStatus */
    rewardStatus: {
      type: String,
      enum: ['collecting', 'pending', 'verified', 'redeemed', 'rejected'],
      default: 'collecting',
      index: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    redeemedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

loyaltyMembershipSchema.index({ user: 1, tenant: 1 }, { unique: true });
loyaltyMembershipSchema.index({ tenant: 1, 'offers.rewardStatus': 1, updatedAt: -1 });
loyaltyMembershipSchema.index({ tenant: 1, 'stampRequests.status': 1, updatedAt: -1 });

module.exports = mongoose.model('LoyaltyMembership', loyaltyMembershipSchema);
