const express = require('express');
const PaymentController = require('@controllers/payment.controller');
const validate = require('@middlewares/validate.middleware');
const { authenticate } = require('@middlewares/auth.middleware');
const { isAdmin } = require('@middlewares/authorize.middleware');
const {
  previewPaymentValidator,
  createOrderValidator,
  verifyPaymentValidator,
} = require('@validators/payment.validator');

const router = express.Router();

router.get('/config', PaymentController.config);
router.post('/preview', previewPaymentValidator, validate, PaymentController.preview);
// Checkout is bound to the authenticated admin — the purchased plan attaches to their tenant.
router.post(
  '/create-order',
  authenticate,
  isAdmin,
  createOrderValidator,
  validate,
  PaymentController.createOrder
);
router.post(
  '/verify',
  authenticate,
  isAdmin,
  verifyPaymentValidator,
  validate,
  PaymentController.verify
);

module.exports = router;
