const PlatformQrService = require('@services/platformQr.service');
const { sendSuccess } = require('@utils/response');
const { HTTP_STATUS } = require('@constants');

class PlatformQrController {
  async create(req, res, next) {
    try {
      const item = await PlatformQrService.create(req.body, req.user?._id);
      return sendSuccess(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'QR entry created',
        data: { item },
      });
    } catch (error) {
      return next(error);
    }
  }

  async list(req, res, next) {
    try {
      const result = await PlatformQrService.list(req.query);
      return sendSuccess(res, {
        message: 'QR entries retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const item = await PlatformQrService.getById(req.params.id);
      return sendSuccess(res, {
        message: 'QR entry retrieved',
        data: { item },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const item = await PlatformQrService.update(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'QR entry updated',
        data: { item },
      });
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await PlatformQrService.remove(req.params.id);
      return sendSuccess(res, {
        message: 'QR entry deleted',
        data: null,
      });
    } catch (error) {
      return next(error);
    }
  }

  async visit(req, res, next) {
    try {
      const result = await PlatformQrService.visitByCode(req.params.code, req);
      return sendSuccess(res, {
        message: 'QR scan recorded',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async go(req, res, next) {
    try {
      const result = await PlatformQrService.visitByCode(req.params.code, req);
      return res.redirect(302, result.url);
    } catch (error) {
      return next(error);
    }
  }

  async reports(req, res, next) {
    try {
      const result = await PlatformQrService.getReports(req.query);
      return sendSuccess(res, {
        message: 'QR reports retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async options(req, res, next) {
    try {
      const items = await PlatformQrService.listOptions();
      return sendSuccess(res, {
        message: 'QR options retrieved',
        data: { items },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new PlatformQrController();
