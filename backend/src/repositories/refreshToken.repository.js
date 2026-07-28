const { RefreshToken } = require('@models');
const { hashToken } = require('@utils/token');

class RefreshTokenRepository {
  async create({ user, token, expiresAt }) {
    return RefreshToken.create({
      user,
      token: hashToken(token),
      expiresAt,
    });
  }

  async findByToken(token) {
    return RefreshToken.findOne({ token: hashToken(token) }).populate('user');
  }

  async deleteByToken(token) {
    return RefreshToken.findOneAndDelete({ token: hashToken(token) });
  }

  async deleteByUser(userId) {
    return RefreshToken.deleteMany({ user: userId });
  }

  async deleteExpired() {
    return RefreshToken.deleteMany({ expiresAt: { $lt: new Date() } });
  }
}

module.exports = new RefreshTokenRepository();
