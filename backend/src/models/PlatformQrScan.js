const mongoose = require('mongoose');

const platformQrScanSchema = new mongoose.Schema(
  {
    qr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlatformQr',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    ip: {
      type: String,
      trim: true,
      default: '',
      maxlength: 80,
    },
    referer: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

platformQrScanSchema.index({ createdAt: -1 });
platformQrScanSchema.index({ qr: 1, createdAt: -1 });

module.exports = mongoose.model('PlatformQrScan', platformQrScanSchema);
