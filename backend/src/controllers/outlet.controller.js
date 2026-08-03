const OutletService = require('@services/outlet.service');
const { sendSuccess } = require('@utils/response');
const { HTTP_STATUS } = require('@constants');

class OutletController {
  async dashboard(req, res, next) {
    try {
      const data = await OutletService.getDashboard(req.user);
      return sendSuccess(res, {
        message: 'Outlet dashboard',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async listSeats(req, res, next) {
    try {
      const seats = await OutletService.listSeats(req.user);
      return sendSuccess(res, {
        message: 'Outlet seats',
        data: { seats },
      });
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const result = await OutletService.createOutlet(req.user, req.body);
      return sendSuccess(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: result.message,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new OutletController();
