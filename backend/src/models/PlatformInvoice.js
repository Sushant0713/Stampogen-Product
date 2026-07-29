const mongoose = require('mongoose');

const platformInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    invoiceDate: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    source: {
      type: String,
      enum: ['payment', 'plan_change'],
      default: 'payment',
      index: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
      index: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    clientName: { type: String, trim: true, default: '' },
    clientEmail: { type: String, trim: true, lowercase: true, default: '', index: true },
    shopName: { type: String, trim: true, default: '' },
    planName: { type: String, trim: true, default: '' },
    billing: { type: String, trim: true, default: '' },
    currency: { type: String, default: 'INR' },
    listAmount: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxableAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    taxMode: { type: String, default: null },
    taxLabel: { type: String, trim: true, default: '' },
    discountCode: { type: String, trim: true, uppercase: true, default: '' },
    emailed: { type: Boolean, default: false },
    recipient: { type: String, trim: true, lowercase: true, default: null },
    attached: { type: Boolean, default: false },
    pdfFileName: { type: String, trim: true, default: null },
    issuedAt: { type: Date, default: Date.now, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

platformInvoiceSchema.index({ issuedAt: -1 });
platformInvoiceSchema.index({ createdAt: -1 });
platformInvoiceSchema.index({ clientEmail: 1, issuedAt: -1 });

module.exports = mongoose.model('PlatformInvoice', platformInvoiceSchema);
