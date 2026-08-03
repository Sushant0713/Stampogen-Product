const PlanService = require('@services/plan.service');
const { sendSuccess } = require('@utils/response');
const { HTTP_STATUS } = require('@constants');

class PlanController {
  async create(req, res, next) {
    try {
      const plan = await PlanService.create(req.body);
      return sendSuccess(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'Plan created',
        data: { plan },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const result = await PlanService.getAll(req.query);
      return sendSuccess(res, {
        message: 'Plans retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getPublic(req, res, next) {
    try {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });
      const forOutlet =
        req.query.forOutlet === '1' ||
        req.query.forOutlet === 'true' ||
        req.query.outlet === '1';
      const result = await PlanService.getPublic({ forOutlet });
      return sendSuccess(res, {
        message: forOutlet ? 'Outlet plans retrieved' : 'Public plans retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const plan = await PlanService.getById(req.params.id);
      return sendSuccess(res, {
        message: 'Plan retrieved',
        data: { plan },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const plan = await PlanService.update(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'Plan updated',
        data: { plan },
      });
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await PlanService.remove(req.params.id);
      return sendSuccess(res, { message: 'Plan deleted' });
    } catch (error) {
      return next(error);
    }
  }

  async removeMany(req, res, next) {
    try {
      const result = await PlanService.removeMany(req.body.ids);
      return sendSuccess(res, {
        message: 'Plans deleted',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new PlanController();
