const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, default: '' },
    pan: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const lineItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    rate: { type: Number, default: 0, min: 0 },
    units: { type: Number, default: 1, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
    igst: { type: Number, default: 0, min: 0 },
    sgst: { type: Number, default: 0, min: 0 },
    cgst: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: '' },
    accountName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    ifsc: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const defaultsSchema = new mongoose.Schema(
  {
    currency: { type: String, trim: true, default: 'INR' },
    invoicePrefix: { type: String, trim: true, default: 'INV' },
    sampleInvoiceNumber: { type: String, trim: true, default: 'INV-2026-00001' },
    sampleInvoiceDate: { type: String, trim: true, default: '' },
    dueDays: { type: Number, default: 30, min: 0 },
    taxMode: {
      type: String,
      enum: ['gst', 'sgst_cgst', 'igst'],
      default: 'igst',
    },
    gstRate: { type: Number, default: 18, min: 0 },
    igstRate: { type: Number, default: 18, min: 0 },
    sgstRate: { type: Number, default: 9, min: 0 },
    cgstRate: { type: Number, default: 9, min: 0 },
    billToTitle: { type: String, trim: true, default: 'Bill To' },
  },
  { _id: false }
);

const invoiceSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'platform',
      unique: true,
    },
    logoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    company: {
      type: addressSchema,
      default: () => ({}),
    },
    sampleCustomer: {
      type: addressSchema,
      default: () => ({}),
    },
    defaults: {
      type: defaultsSchema,
      default: () => ({}),
    },
    sampleItems: {
      type: [lineItemSchema],
      default: [],
    },
    payment: {
      type: paymentSchema,
      default: () => ({}),
    },
    terms: {
      type: [String],
      default: [],
    },
    signatureUrl: {
      type: String,
      trim: true,
      default: '',
    },
    closingNote: {
      type: String,
      trim: true,
      default: 'Thank you for your business',
    },
    showMadeWithBadge: {
      type: Boolean,
      default: true,
    },
    madeWithImageUrl: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('InvoiceSettings', invoiceSettingsSchema);
