const mongoose = require('mongoose');

const billingProfileSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true, default: '' },
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pin: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    pan: { type: String, trim: true, uppercase: true, default: '' },
  },
  { _id: false }
);

/**
 * Admin signup draft — User/Tenant are created only after successful payment.
 * TTL deletes abandoned drafts after expiresAt.
 */
const pendingAdminRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null,
      select: false,
    },
    googleId: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    middleName: { type: String, trim: true, maxlength: 50, default: '' },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    phone: { type: String, trim: true, default: '' },
    tenantName: { type: String, required: true, trim: true, maxlength: 120 },
    loyaltyStampMode: { type: String, trim: true, default: 'bill' },
    category: { type: String, trim: true, default: '' },
    customCategory: { type: String, trim: true, default: '' },
    billingProfile: { type: billingProfileSchema, default: () => ({}) },
    planCode: { type: String, trim: true, lowercase: true, default: '' },
    discountCode: { type: String, trim: true, uppercase: true, default: '' },
    emailVerifiedAt: { type: Date, default: null },
    registrationTokenHash: { type: String, default: null, select: false, index: true },
    registrationTokenExpiresAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

pendingAdminRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingAdminRegistration', pendingAdminRegistrationSchema);
