const { OAuth } = require('@models');

class OAuthRepository {
  async findByProvider(provider, providerId) {
    return OAuth.findOne({ provider, providerId }).populate('user');
  }

  async findByUser(userId) {
    return OAuth.find({ user: userId });
  }

  async create(data) {
    return OAuth.create(data);
  }

  async deleteByUser(userId) {
    return OAuth.deleteMany({ user: userId });
  }

  async deleteByProvider(provider, providerId) {
    return OAuth.deleteMany({ provider, providerId });
  }
}

module.exports = new OAuthRepository();
