const mongoose = require('mongoose');

const oauthSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ['google'],
      lowercase: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

oauthSchema.index({ provider: 1, providerId: 1 }, { unique: true });
oauthSchema.index({ user: 1 });

module.exports = mongoose.model('OAuth', oauthSchema);
