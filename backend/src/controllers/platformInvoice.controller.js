const PlatformInvoiceService = require('@services/platformInvoice.service');
const { sendSuccess } = require('@utils/response');

class PlatformInvoiceController {
  async list(req, res, next) {
    try {
      const {
        page,
        limit,
        search,
        source,
        planName,
        discountCode,
        billing,
        emailed,
        dateFrom,
        dateTo,
      } = req.query;
      const result = await PlatformInvoiceService.list({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        search: search || '',
        source: source || '',
        planName: planName || '',
        discountCode: discountCode || '',
        billing: billing || '',
        emailed: emailed || '',
        dateFrom: dateFrom || '',
        dateTo: dateTo || '',
      });

      return sendSuccess(res, {
        message: 'Platform invoices retrieved',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  async getFilterOptions(req, res, next) {
    try {
      const options = await PlatformInvoiceService.getFilterOptions();
      return sendSuccess(res, {
        message: 'Platform invoice filter options retrieved',
        data: { options },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await PlatformInvoiceService.getStats();
      return sendSuccess(res, {
        message: 'Platform invoice stats retrieved',
        data: { stats },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const invoice = await PlatformInvoiceService.getById(req.params.id);
      return sendSuccess(res, {
        message: 'Platform invoice retrieved',
        data: { invoice },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getPdf(req, res, next) {
    try {
      const { pdfBuffer, fileName, contentType, record } =
        await PlatformInvoiceService.buildPdfForRecord(req.params.id);

      const disposition = req.query.download === '1' ? 'attachment' : 'inline';
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${fileName || `${record.invoiceNumber}.pdf`}"`
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await PlatformInvoiceService.remove(req.params.id);
      return sendSuccess(res, {
        message: 'Platform invoice removed',
      });
    } catch (error) {
      return next(error);
    }
  }

  async removeMany(req, res, next) {
    try {
      const result = await PlatformInvoiceService.removeMany(req.body.ids);
      return sendSuccess(res, {
        message: 'Platform invoices removed',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new PlatformInvoiceController();
