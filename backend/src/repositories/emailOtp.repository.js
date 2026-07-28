const { EmailOtp } = require('@models');

class EmailOtpRepository {
  async upsert({ email, code, purpose, expiresAt }) {
    return EmailOtp.findOneAndUpdate(
      { email: email.toLowerCase(), purpose },
      { code, expiresAt, attempts: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async findValid(email, purpose) {
    return EmailOtp.findOne({
      email: email.toLowerCase(),
      purpose,
      expiresAt: { $gt: new Date() },
    });
  }

  async incrementAttempts(id) {
    return EmailOtp.findByIdAndUpdate(id, { $inc: { attempts: 1 } }, { new: true });
  }

  async deleteByEmail(email, purpose) {
    const filter = { email: email.toLowerCase() };
    if (purpose) filter.purpose = purpose;
    return EmailOtp.deleteMany(filter);
  }
}

module.exports = new EmailOtpRepository();
