const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    planName: { type: String, required: true, trim: true },
    planCode: { type: String, required: true, trim: true, lowercase: true },
    billing: {
      type: String,
      enum: ['Monthly', 'Yearly', 'Custom'],
      default: 'Monthly',
    },
    customerName: { type: String, trim: true, default: '' },
    customerEmail: { type: String, trim: true, lowercase: true, default: '' },
    customerPhone: { type: String, trim: true, default: '' },
    currency: { type: String, default: 'INR' },
    listAmount: { type: Number, required: true, min: 0 },
    discountCode: { type: String, trim: true, uppercase: true, default: '' },
    discountAmount: { type: Number, default: 0, min: 0 },
    /** list − discount (before GST) */
    taxableAmount: { type: Number, default: 0, min: 0 },
    taxMode: {
      type: String,
      enum: ['gst', 'sgst_cgst', 'igst'],
      default: null,
    },
    taxLabel: { type: String, trim: true, default: '' },
    taxAmount: { type: Number, default: 0, min: 0 },
    cgstAmount: { type: Number, default: 0, min: 0 },
    sgstAmount: { type: Number, default: 0, min: 0 },
    igstAmount: { type: Number, default: 0, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    /** taxable + GST — amount charged on Razorpay */
    payableAmount: { type: Number, required: true, min: 0 },
    razorpayOrderId: { type: String, default: null, index: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'free'],
      default: 'created',
      index: true,
    },
    paidAt: { type: Date, default: null },
    invoiceNumber: { type: String, default: null },
    invoiceEmailed: { type: Boolean, default: false },
    invoiceRecipient: { type: String, default: null },
    invoicedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ discountCode: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
