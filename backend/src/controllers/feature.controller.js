const FeatureService = require('@services/feature.service');
const { sendSuccess } = require('@utils/response');
const { HTTP_STATUS } = require('@constants');

class FeatureController {
  async create(req, res, next) {
    try {
      const feature = await FeatureService.create(req.body);
      return sendSuccess(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'Feature created',
        data: { feature },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const result = await FeatureService.getAll(req.query);
      return sendSuccess(res, {
        message: 'Features retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const feature = await FeatureService.getById(req.params.id);
      return sendSuccess(res, {
        message: 'Feature retrieved',
        data: { feature },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const feature = await FeatureService.update(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'Feature updated',
        data: { feature },
      });
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await FeatureService.remove(req.params.id);
      return sendSuccess(res, { message: 'Feature deleted' });
    } catch (error) {
      return next(error);
    }
  }

  async removeMany(req, res, next) {
    try {
      const result = await FeatureService.removeMany(req.body.ids);
      return sendSuccess(res, {
        message: 'Features deleted',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new FeatureController();
