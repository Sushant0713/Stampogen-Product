const SuperAdminDashboardService = require('@services/superAdminDashboard.service');
const { sendSuccess } = require('@utils/response');

class SuperAdminDashboardController {
  async get(req, res, next) {
    try {
      const dashboard = await SuperAdminDashboardService.get({
        period: req.query.period,
        from: req.query.from,
        to: req.query.to,
      });
      return sendSuccess(res, {
        message: 'Super admin dashboard retrieved',
        data: { dashboard },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new SuperAdminDashboardController();
