const mongoose = require('mongoose');

const agreementSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'affiliate',
      unique: true,
    },
    title: {
      type: String,
      trim: true,
      default: 'Terms and Conditions',
      maxlength: 200,
    },
    content: {
      type: String,
      trim: true,
      default: '',
      maxlength: 50000,
    },
    version: {
      type: String,
      trim: true,
      default: '1.0',
      maxlength: 40,
    },
    effectiveDate: {
      type: String,
      trim: true,
      default: '',
    },
    requireAcceptance: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AgreementSettings', agreementSettingsSchema);
