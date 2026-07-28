const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema(
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
    category: {
      type: String,
      enum: ['Core', 'Brand', 'Analytics', 'Integrations', 'Support'],
      default: 'Core',
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    timesUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Enabled', 'Disabled'],
      default: 'Enabled',
    },
  },
  {
    timestamps: true,
  }
);

featureSchema.index({ status: 1 });
featureSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feature', featureSchema);
