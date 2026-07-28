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
}

module.exports = new AffiliateEarningsController();
