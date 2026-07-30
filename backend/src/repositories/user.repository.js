const { User } = require('@models');

/** Slim populate for auth /me / middleware — avoid shipping full tenant docs */
const AUTH_ROLE_POPULATE = { path: 'role', select: 'slug name' };
const AUTH_TENANT_POPULATE = {
  path: 'tenant',
  select: 'name slug status billingProfile currentPlan pendingPlan loyaltyStampMode socialLinks',
};

function withAuthPopulate(query) {
  return query.populate(AUTH_ROLE_POPULATE).populate(AUTH_TENANT_POPULATE);
}

class UserRepository {
  async findById(id, { includeVerificationDocument = false } = {}) {
    let query = withAuthPopulate(User.findById(id));
    if (includeVerificationDocument) {
      // Explicit inclusion of select:false credential + document fields for SA View
      query = query.select(
        '+verificationDocument +resumeDocument +signedAgreementDocument +affiliateIssuedPassword'
      );
    }
    return query;
  }

  async findByEmail(email) {
    return withAuthPopulate(User.findOne({ email: email.toLowerCase() }));
  }

  async findByEmailWithPassword(email) {
    return withAuthPopulate(
      User.findOne({ email: email.toLowerCase() }).select('+password')
    );
  }

  async findByGoogleId(googleId) {
    return withAuthPopulate(User.findOne({ googleId }));
  }

  async create(data) {
    const user = await User.create(data);
    return this.findById(user._id);
  }

  async updateById(id, data) {
    return withAuthPopulate(
      User.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    );
  }

  async updateCredentials(id, { firstName, middleName, lastName, birthDate, password, phone }) {
    const user = await User.findById(id).select('+password');
    if (!user) return null;

    if (firstName !== undefined) user.firstName = firstName;
    if (middleName !== undefined) user.middleName = middleName;
    if (lastName !== undefined) user.lastName = lastName;
    if (birthDate !== undefined) user.birthDate = birthDate;
    if (password !== undefined) user.password = password;
    if (phone !== undefined) user.phone = phone;

    await user.save();
    return this.findById(user._id);
  }

  async findAll(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = '-createdAt', search } = options;
    const skip = (page - 1) * limit;
    const query = { ...filter };

    if (search) {
      const q = String(search).trim();
      if (q) {
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
          { firstName: regex },
          { middleName: regex },
          { lastName: regex },
          { email: regex },
          { phone: regex },
        ];
      }
    }

    const [users, total] = await Promise.all([
      withAuthPopulate(User.find(query)).sort(sort).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /** Counts for affiliate list header + sidebar badges. */
  async affiliateStats() {
    const RoleRepository = require('@repositories/role.repository');
    const { ROLES } = require('@constants/roles');
    const {
      AFFILIATE_APPROVAL_STATUS,
      AFFILIATE_PENDING_STATUSES,
    } = require('@constants/affiliateApproval');

    const role = await RoleRepository.findBySlug(ROLES.AFFILIATE);
    if (!role) {
      return { total: 0, active: 0, inactive: 0, pendingApprovals: 0 };
    }

    const [approvedRow, pendingApprovals] = await Promise.all([
      User.aggregate([
        {
          $match: {
            role: role._id,
            // Include legacy affiliates with no approval field (mirrors list filter)
            affiliateApprovalStatus: { $in: [AFFILIATE_APPROVAL_STATUS.APPROVED, null] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } },
            inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
          },
        },
      ]),
      User.countDocuments({
        role: role._id,
        affiliateApprovalStatus: { $in: AFFILIATE_PENDING_STATUSES },
      }),
    ]);

    const row = approvedRow[0];
    return {
      total: row?.total || 0,
      active: row?.active || 0,
      inactive: row?.inactive || 0,
      pendingApprovals: pendingApprovals || 0,
    };
  }

  async findIdsByRoleSlug(roleSlug) {
    const RoleRepository = require('@repositories/role.repository');
    const role = await RoleRepository.findBySlug(roleSlug);
    if (!role) return [];
    const users = await User.find({ role: role._id, isActive: true }).select('_id email firstName lastName').lean();
    return users;
  }

  async updateLastLogin(id) {
    return User.findByIdAndUpdate(id, { lastLogin: new Date() }, { new: true });
  }

  async findBySignedAgreementTokenHash(tokenHash) {
    return withAuthPopulate(
      User.findOne({ signedAgreementUploadTokenHash: tokenHash }).select(
        '+signedAgreementUploadTokenHash +signedAgreementDocument'
      )
    );
  }

  async findByCredentialsClaimTokenHash(tokenHash) {
    return withAuthPopulate(
      User.findOne({ affiliateCredentialsClaimTokenHash: tokenHash }).select(
        '+affiliateCredentialsClaimTokenHash +affiliateIssuedPassword'
      )
    );
  }

  async setCredentialsClaimToken(id, { tokenHash, expiresAt }) {
    return User.findByIdAndUpdate(
      id,
      {
        $set: {
          affiliateCredentialsClaimTokenHash: tokenHash,
          affiliateCredentialsClaimExpiresAt: expiresAt,
        },
      },
      { new: true }
    );
  }

  async updateSignedAgreementUpload(id, {
    document,
    documentName,
    uploadedAt,
  }) {
    const user = await User.findById(id).select(
      '+signedAgreementDocument +signedAgreementUploadTokenHash'
    );
    if (!user) return null;

    user.signedAgreementDocument = document;
    user.signedAgreementDocumentName = documentName || 'signed-agreement';
    user.signedAgreementUploadedAt = uploadedAt || new Date();
    user.markModified('signedAgreementDocument');
    await user.save();

    await User.findByIdAndUpdate(id, {
      $unset: {
        signedAgreementUploadTokenHash: 1,
        signedAgreementUploadExpiresAt: 1,
      },
    });

    return this.findById(user._id, { includeVerificationDocument: true });
  }

  async setAffiliateIssuedPassword(id, plaintextPassword) {
    const value = String(plaintextPassword || '');
    if (!id || !value) return null;

    // Atomic $set — avoid document save hooks accidentally touching password
    return User.findByIdAndUpdate(
      id,
      {
        $set: {
          affiliateIssuedPassword: value,
          affiliateCredentialsIssuedAt: new Date(),
        },
      },
      { new: true }
    ).select('+affiliateIssuedPassword');
  }

  async deleteById(id) {
    return User.findByIdAndDelete(id);
  }
}

module.exports = new UserRepository();
