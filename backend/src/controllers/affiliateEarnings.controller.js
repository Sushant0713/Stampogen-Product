const AffiliateEarningsService = require('@services/affiliateEarnings.service');
const { sendSuccess } = require('@utils/response');

class AffiliateEarningsController {
  async getSummary(req, res, next) {
    try {
      const summary = await AffiliateEarningsService.getSummary(req.user);
      return sendSuccess(res, {
        message: 'Affiliate earnings retrieved',
        data: { summary },
      });
    } catch (error) {
      return next(error);
    }
  }

  async redeem(req, res, next) {
    try {
      const result = await AffiliateEarningsService.redeem(req.user, req.body || {});
      return sendSuccess(res, {
        message: 'Redeem request recorded. Current progress reset.',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async listRedeems(req, res, next) {
    try {
      const redeems = await AffiliateEarningsService.listRedeems(req.user);
      return sendSuccess(res, {
        message: 'Redeem history retrieved',
        data: { redeems },
      });
    } catch (error) {
      return next(error);
    }
  }

  async listAllRedeems(req, res, next) {
    try {
      const result = await AffiliateEarningsService.listAllRedeemsForAdmin(req.query || {});
      return sendSuccess(res, {
        message: 'Affiliate redeem requests retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async markPaid(req, res, next) {
    try {
      const redeem = await AffiliateEarningsService.markRedeemPaid(req.params.id, req.body || {});
      return sendSuccess(res, {
        message: 'Redeem marked as paid. Affiliate notified by email.',
        data: { redeem },
      });
    } catch (error) {
      return next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const redeem = await AffiliateEarningsService.rejectRedeem(req.params.id, req.body || {});
      return sendSuccess(res, {
        message: 'Redeem rejected. Amount returned to affiliate balance and email sent.',
        data: { redeem },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AffiliateEarningsController();
