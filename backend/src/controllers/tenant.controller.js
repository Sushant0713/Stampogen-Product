const TenantService = require('@services/tenant.service');
const { sendSuccess } = require('@utils/response');
const { HTTP_STATUS } = require('@constants');

class TenantController {
  async create(req, res, next) {
    try {
      const result = await TenantService.createClient(req.body);

      return sendSuccess(res, {
        statusCode: HTTP_STATUS.CREATED,
        message: 'Client created',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const { page, limit, status, search } = req.query;
      const filter = status ? { status } : {};
      const result = await TenantService.getAll(filter, {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        search: search || '',
      });

      return sendSuccess(res, {
        message: 'Tenants retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await TenantService.getStats();
      return sendSuccess(res, {
        message: 'Tenant stats retrieved',
        data: { stats },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const tenant = await TenantService.getById(req.params.id);
      return sendSuccess(res, {
        message: 'Tenant retrieved',
        data: { tenant },
      });
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const tenant = await TenantService.update(req.params.id, req.body);
      return sendSuccess(res, {
        message: 'Tenant updated',
        data: { tenant },
      });
    } catch (error) {
      return next(error);
    }
  }

  async changePlan(req, res, next) {
    try {
      const tenant = await TenantService.changePlan(req.params.id, {
        planName: req.body.planName,
        planId: req.body.planId,
        planCode: req.body.planCode,
      });
      const invoiceNote = tenant.invoice?.emailed
        ? ` Invoice ${tenant.invoice.invoiceNumber} emailed to client.`
        : tenant.invoice?.invoiceNumber
          ? ` Invoice ${tenant.invoice.invoiceNumber} generated.`
          : '';
      return sendSuccess(res, {
        message: `Plan updated.${invoiceNote}`,
        data: { tenant },
      });
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await TenantService.remove(req.params.id);
      return sendSuccess(res, {
        message: 'Tenant deleted',
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new TenantController();
