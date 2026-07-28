const LoyaltyMembership = require('@models/LoyaltyMembership');

const TENANT_POPULATE = {
  path: 'tenant',
  select: 'name slug status billingProfile loyaltyOffers loyaltyStampMode',
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
}

module.exports = new LoyaltyMembershipRepository();
