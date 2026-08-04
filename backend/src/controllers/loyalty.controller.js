const LoyaltyService = require('@services/loyalty.service');
const { sendSuccess } = require('@utils/response');
const { HTTP_STATUS } = require('@constants');

function outletScope(req) {
  return (
    req.query?.outletTenantId ||
    req.body?.outletTenantId ||
    undefined
  );
}

class LoyaltyController {
  async shopPreview(req, res, next) {
    try {
      const shop = await LoyaltyService.getShopPreview(req.params.slug);
      return sendSuccess(res, {
        message: 'Shop preview',
        data: { shop },
      });
    } catch (error) {
      return next(error);
    }
  }

  async join(req, res, next) {
    try {
      const result = await LoyaltyService.joinShop(req.user._id, req.body.tenantSlug);
      return sendSuccess(res, {
        statusCode: result.alreadyMember ? HTTP_STATUS.OK : HTTP_STATUS.CREATED,
        message: result.alreadyMember ? 'Already a member of this shop' : 'Joined shop successfully',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async listCards(req, res, next) {
    try {
      const cards = await LoyaltyService.listCards(req.user._id);
      return sendSuccess(res, {
        message: 'Loyalty cards retrieved',
        data: { cards },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getCard(req, res, next) {
    try {
      const card = await LoyaltyService.getCard(req.user._id, req.params.slug);
      return sendSuccess(res, {
        message: 'Loyalty card retrieved',
        data: { card },
      });
    } catch (error) {
      return next(error);
    }
  }

  async listRewards(req, res, next) {
    try {
      const rewards = await LoyaltyService.listRewards(req.user._id);
      return sendSuccess(res, {
        message: 'Rewards retrieved',
        data: { rewards },
      });
    } catch (error) {
      return next(error);
    }
  }

  async listHistory(req, res, next) {
    try {
      const history = await LoyaltyService.listHistory(req.user._id);
      return sendSuccess(res, {
        message: 'Activity history retrieved',
        data: history,
      });
    } catch (error) {
      return next(error);
    }
  }

  async addStamp(req, res, next) {
    try {
      const result = await LoyaltyService.addStamp(req.user._id, req.params.slug, {
        offerKey: req.body.offerKey,
        offerTitle: req.body.offerTitle,
        billDocument: req.body.billDocument,
        billDocumentName: req.body.billDocumentName,
      });
      return sendSuccess(res, {
        message: result.message,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async requestStamp(req, res, next) {
    try {
      const result = await LoyaltyService.requestStamp(req.user._id, req.params.slug, {
        offerKey: req.body.offerKey,
        offerTitle: req.body.offerTitle,
      });
      return sendSuccess(res, {
        message: result.message,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async redeem(req, res, next) {
    try {
      const result = await LoyaltyService.redeemReward(req.user._id, req.params.slug, {
        offerKey: req.body.offerKey,
      });
      return sendSuccess(res, {
        message: result.message,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminListRewards(req, res, next) {
    try {
      const filter = req.query.filter || 'pending';
      const rewards = await LoyaltyService.listAdminRewards(req.user, {
        filter,
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: 'Shop rewards retrieved',
        data: { rewards },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminListCustomers(req, res, next) {
    try {
      const customers = await LoyaltyService.listAdminCustomers(req.user, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: 'Shop customers retrieved',
        data: { customers },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminGetCustomer(req, res, next) {
    try {
      const customer = await LoyaltyService.getAdminCustomerDetail(
        req.user,
        req.params.id,
        { outletTenantId: outletScope(req) }
      );
      return sendSuccess(res, {
        message: 'Customer details retrieved',
        data: { customer },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminUpdateCustomer(req, res, next) {
    try {
      const customer = await LoyaltyService.updateAdminCustomerStatus(
        req.user,
        req.params.id,
        req.body.status,
        { outletTenantId: outletScope(req) }
      );
      return sendSuccess(res, {
        message: customer.status === 'suspended' ? 'Customer suspended' : 'Customer activated',
        data: { customer },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminDeleteCustomer(req, res, next) {
    try {
      await LoyaltyService.deleteAdminCustomer(req.user, req.params.id, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: 'Customer removed from your shop',
        data: { deleted: true },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminDashboardStats(req, res, next) {
    try {
      const stats = await LoyaltyService.getAdminDashboardStats(req.user, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: 'Dashboard stats retrieved',
        data: { stats },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminListOffers(req, res, next) {
    try {
      const offers = await LoyaltyService.listAdminOffers(req.user);
      return sendSuccess(res, {
        message: 'Shop offers retrieved',
        data: { offers },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminCreateOffer(req, res, next) {
    try {
      const offer = await LoyaltyService.createAdminOffer(req.user, req.body);
      return sendSuccess(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'Offer created',
        data: { offer },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminUpdateOffer(req, res, next) {
    try {
      const offer = await LoyaltyService.updateAdminOffer(req.user, req.params.key, req.body);
      return sendSuccess(res, {
        message: 'Offer updated',
        data: { offer },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminGetSettings(req, res, next) {
    try {
      const settings = await LoyaltyService.getAdminSettings(req.user);
      return sendSuccess(res, {
        message: 'Shop settings retrieved',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminUpdateSettings(req, res, next) {
    try {
      const settings = await LoyaltyService.updateAdminSettings(req.user, req.body);
      return sendSuccess(res, {
        message: 'Shop settings updated',
        data: { settings },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminListStampRequests(req, res, next) {
    try {
      const requests = await LoyaltyService.listAdminStampRequests(req.user, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: 'Stamp requests retrieved',
        data: { requests },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminListRecentBillStamps(req, res, next) {
    try {
      const stamps = await LoyaltyService.listAdminRecentBillStamps(req.user);
      return sendSuccess(res, {
        message: 'Recent bill stamps retrieved',
        data: { stamps },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminApproveStampRequest(req, res, next) {
    try {
      const result = await LoyaltyService.approveStampRequest(req.user, req.params.id, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: result.message,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminRejectStampRequest(req, res, next) {
    try {
      const result = await LoyaltyService.rejectStampRequest(req.user, req.params.id, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: result.message,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminGetReward(req, res, next) {
    try {
      const reward = await LoyaltyService.getAdminRewardDetail(req.user, req.params.id, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: 'Reward detail retrieved',
        data: { reward },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminVerify(req, res, next) {
    try {
      const reward = await LoyaltyService.verifyAdminReward(req.user, req.params.id, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: 'Bills verified',
        data: { reward },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminCancel(req, res, next) {
    try {
      const reward = await LoyaltyService.cancelAdminReward(req.user, req.params.id, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: 'Reward request cancelled',
        data: { reward },
      });
    } catch (error) {
      return next(error);
    }
  }

  async adminGive(req, res, next) {
    try {
      const reward = await LoyaltyService.giveAdminReward(req.user, req.params.id, {
        outletTenantId: outletScope(req),
      });
      return sendSuccess(res, {
        message: 'Reward given to customer',
        data: { reward },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new LoyaltyController();
