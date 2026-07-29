const LoyaltyMembership = require('@models/LoyaltyMembership');

const TENANT_POPULATE = {
  path: 'tenant',
  select: 'name slug status billingProfile loyaltyOffers loyaltyStampMode category customCategory socialLinks',
};

const USER_POPULATE = {
  path: 'user',
  select: 'firstName lastName email phone avatar',
};

class LoyaltyMembershipRepository {
  async findByUserAndTenant(userId, tenantId) {
    return LoyaltyMembership.findOne({ user: userId, tenant: tenantId }).populate(TENANT_POPULATE);
  }

  async findByUser(userId) {
    return LoyaltyMembership.find({ user: userId, status: 'active' })
      .populate(TENANT_POPULATE)
      .sort({ updatedAt: -1 });
  }

  async findById(id) {
    return LoyaltyMembership.findById(id).populate(TENANT_POPULATE).populate(USER_POPULATE);
  }

  async findByIdWithBills(id) {
    return LoyaltyMembership.findById(id)
      .select('+bills')
      .populate(TENANT_POPULATE)
      .populate(USER_POPULATE);
  }

  async findByTenant(tenantId) {
    return LoyaltyMembership.find({ tenant: tenantId, status: 'active' })
      .populate(USER_POPULATE)
      .sort({ updatedAt: -1 });
  }

  async findByTenantForAdmin(tenantId) {
    return LoyaltyMembership.find({ tenant: tenantId })
      .populate(USER_POPULATE)
      .sort({ updatedAt: -1 });
  }

  async deleteById(id) {
    return LoyaltyMembership.findByIdAndDelete(id);
  }

  async findWithPendingStampRequests(tenantId) {
    return LoyaltyMembership.find({
      tenant: tenantId,
      status: 'active',
      stampRequests: { $elemMatch: { status: 'pending' } },
    })
      .populate(USER_POPULATE)
      .sort({ updatedAt: -1 });
  }

  async create(data) {
    return LoyaltyMembership.create(data);
  }

  async updateById(id, data) {
    return LoyaltyMembership.findByIdAndUpdate(id, data, { new: true })
      .populate(TENANT_POPULATE)
      .populate(USER_POPULATE);
  }

  async addStampWithBill(
    id,
    {
      offerKey,
      offerTitle,
      billDocument,
      billDocumentName,
      offers,
      primaryStamps,
      primaryRewardStatus,
    }
  ) {
    return LoyaltyMembership.findByIdAndUpdate(
      id,
      {
        $set: {
          offers,
          stamps: primaryStamps,
          rewardStatus: primaryRewardStatus,
          lastStampAt: new Date(),
          lastOfferTitle: offerTitle,
          lastOfferKey: offerKey,
          lastBillDocumentName: billDocumentName,
        },
        $inc: { billCount: 1 },
        $push: {
          bills: {
            document: billDocument,
            documentName: billDocumentName,
            offerKey,
            offerTitle,
            stampedAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate(TENANT_POPULATE);
  }

  async countByTenant(tenantId) {
    return LoyaltyMembership.countDocuments({ tenant: tenantId, status: 'active' });
  }

  /**
   * Recent bill stamps for a shop (metadata only — no bill image payloads).
   */
  async findRecentBillStamps(tenantId, { sinceHours = 24, limit = 40 } = {}) {
    const mongoose = require('mongoose');
    const since = new Date(Date.now() - Math.max(1, sinceHours) * 60 * 60 * 1000);
    const tenantOid = new mongoose.Types.ObjectId(String(tenantId));
    const max = Math.min(100, Math.max(1, limit));

    return LoyaltyMembership.aggregate([
      {
        $match: {
          tenant: tenantOid,
          billCount: { $gt: 0 },
          lastStampAt: { $gte: since },
        },
      },
      {
        $project: {
          user: 1,
          bills: {
            $filter: {
              input: { $ifNull: ['$bills', []] },
              as: 'b',
              cond: { $gte: ['$$b.stampedAt', since] },
            },
          },
        },
      },
      { $unwind: '$bills' },
      { $sort: { 'bills.stampedAt': -1 } },
      { $limit: max },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          id: { $toString: '$bills._id' },
          membershipId: { $toString: '$_id' },
          offerTitle: { $ifNull: ['$bills.offerTitle', ''] },
          offerKey: { $ifNull: ['$bills.offerKey', ''] },
          stampedAt: '$bills.stampedAt',
          firstName: '$userDoc.firstName',
          middleName: '$userDoc.middleName',
          lastName: '$userDoc.lastName',
          email: '$userDoc.email',
        },
      },
    ]);
  }
}

module.exports = new LoyaltyMembershipRepository();
