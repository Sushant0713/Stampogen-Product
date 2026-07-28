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
  },
  {
    timestamps: true,
  }
);

planSchema.index({ status: 1 });
planSchema.index({ enabled: 1 });
planSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Plan', planSchema);
