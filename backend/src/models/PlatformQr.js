const mongoose = require('mongoose');

const platformQrSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    code: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      maxlength: 32,
    },
    scanCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastScannedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

platformQrSchema.index({ createdAt: -1 });
platformQrSchema.index({ scanCount: -1 });

module.exports = mongoose.model('PlatformQr', platformQrSchema);
