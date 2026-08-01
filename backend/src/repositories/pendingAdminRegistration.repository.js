const crypto = require('crypto');
const { PendingAdminRegistration } = require('@models');

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function publicView(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: String(plain._id),
    email: plain.email,
    firstName: plain.firstName,
    middleName: plain.middleName || '',
    lastName: plain.lastName,
    phone: plain.phone || plain.billingProfile?.phone || '',
    tenantName: plain.tenantName,
    planCode: plain.planCode || '',
    discountCode: plain.discountCode || '',
    emailVerified: Boolean(plain.emailVerifiedAt),
    billingProfile: plain.billingProfile || {},
  };
}

class PendingAdminRegistrationRepository {
  draftTtlMs() {
    return DRAFT_TTL_MS;
  }

  tokenTtlMs() {
    return TOKEN_TTL_MS;
  }

  hashToken(token) {
    return hashToken(token);
  }

  toPublicView(doc) {
    return publicView(doc);
  }

  async findByEmail(email, { withSecrets = false } = {}) {
    let query = PendingAdminRegistration.findOne({ email: String(email || '').toLowerCase() });
    if (withSecrets) {
      query = query.select('+passwordHash +registrationTokenHash');
    }
    return query;
  }

  async findById(id, { withSecrets = false } = {}) {
    let query = PendingAdminRegistration.findById(id);
    if (withSecrets) {
      query = query.select('+passwordHash +registrationTokenHash');
    }
    return query;
  }

  async findByValidToken(token) {
    const hash = hashToken(token);
    return PendingAdminRegistration.findOne({
      registrationTokenHash: hash,
      emailVerifiedAt: { $ne: null },
      registrationTokenExpiresAt: { $gt: new Date() },
      expiresAt: { $gt: new Date() },
    }).select('+passwordHash +registrationTokenHash');
  }

  async upsertByEmail(email, data) {
    const expiresAt = new Date(Date.now() + DRAFT_TTL_MS);
    return PendingAdminRegistration.findOneAndUpdate(
      { email: String(email).toLowerCase() },
      {
        $set: {
          ...data,
          email: String(email).toLowerCase(),
          expiresAt,
          emailVerifiedAt: data.emailVerifiedAt ?? null,
          registrationTokenHash: data.registrationTokenHash ?? null,
          registrationTokenExpiresAt: data.registrationTokenExpiresAt ?? null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    ).select('+passwordHash +registrationTokenHash');
  }

  async issueRegistrationToken(id) {
    const plainToken = crypto.randomBytes(32).toString('hex');
    const registrationTokenHash = hashToken(plainToken);
    const registrationTokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const emailVerifiedAt = new Date();

    const doc = await PendingAdminRegistration.findByIdAndUpdate(
      id,
      {
        $set: {
          emailVerifiedAt,
          registrationTokenHash,
          registrationTokenExpiresAt,
          expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
        },
      },
      { new: true }
    ).select('+passwordHash +registrationTokenHash');

    return { draft: doc, registrationToken: plainToken };
  }

  async deleteByEmail(email) {
    return PendingAdminRegistration.deleteOne({ email: String(email || '').toLowerCase() });
  }

  async deleteById(id) {
    return PendingAdminRegistration.findByIdAndDelete(id);
  }
}

module.exports = new PendingAdminRegistrationRepository();
