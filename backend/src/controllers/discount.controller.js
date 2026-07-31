const DiscountService = require('@services/discount.service');
const { sendSuccess } = require('@utils/response');
const { HTTP_STATUS } = require('@constants');

class DiscountController {
  async create(req, res, next) {
    try {
      const discount = await DiscountService.create(req.body);
      return sendSuccess(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'Discount created',
        data: { discount },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const result = await DiscountService.getAll(req.query);
      return sendSuccess(res, {
        message: 'Discounts retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await DiscountService.getStats();
      return sendSuccess(res, {
        message: 'Discount stats retrieved',
        data: { stats },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getPublic(req, res, next) {
    try {
      const result = await DiscountService.getPublicOneTime();
      return sendSuccess(res, {
        message: 'Public discounts retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const discount = await DiscountService.getById(req.params.id);
      return sendSuccess(res, {
        message: 'Discount retrieved',
        data: { discount },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const discount = await DiscountService.update(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'Discount updated',
        data: { discount },
      });
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await DiscountService.remove(req.params.id);
      return sendSuccess(res, {
        message: 'Discount deleted',
      });
    } catch (error) {
      return next(error);
    }
  }

  async removeMany(req, res, next) {
    try {
      const result = await DiscountService.removeMany(req.body.ids);
      return sendSuccess(res, {
        message: 'Discounts deleted',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new DiscountController();
