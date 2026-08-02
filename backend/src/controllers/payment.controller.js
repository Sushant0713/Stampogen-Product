const PaymentService = require('@services/payment.service');
const { sendSuccess } = require('@utils/response');

class PaymentController {
  async config(req, res, next) {
    try {
      const data = await PaymentService.getPublicConfig();
      return sendSuccess(res, { message: 'Payment config', data });
    } catch (error) {
      return next(error);
    }
  }

  async preview(req, res, next) {
    try {
      const quote = await PaymentService.preview(req.body);
      return sendSuccess(res, { message: 'Quote ready', data: { quote } });
    } catch (error) {
      return next(error);
    }
  }

  async createOrder(req, res, next) {
    try {
      const order = await PaymentService.createOrder(req.body, {
        user: req.user || null,
        pendingRegistration: req.pendingRegistration || null,
      });
      return sendSuccess(res, { message: 'Order created', data: { order } });
    } catch (error) {
      return next(error);
    }
  }

  async verify(req, res, next) {
    try {
      const payment = await PaymentService.verify(req.body, {
        user: req.user || null,
        pendingRegistration: req.pendingRegistration || null,
      });
      return sendSuccess(res, { message: 'Payment verified', data: { payment } });
    } catch (error) {
      return next(error);
    }
  }

  async startTrial(req, res, next) {
    try {
      const result = await PaymentService.startTrial(
        {
          user: req.user || null,
          pendingRegistration: req.pendingRegistration || null,
        },
        { discountCode: req.body?.discountCode }
      );
      return sendSuccess(res, {
        message: `Free trial started on ${result.planName}`,
        data: { trial: result },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new PaymentController();
