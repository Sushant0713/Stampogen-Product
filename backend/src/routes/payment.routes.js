const express = require('express');
const PaymentController = require('@controllers/payment.controller');
const validate = require('@middlewares/validate.middleware');
const { resolvePaymentActor } = require('@middlewares/paymentIdentity.middleware');
const {
  previewPaymentValidator,
  createOrderValidator,
  verifyPaymentValidator,
  startTrialValidator,
} = require('@validators/payment.validator');

const router = express.Router();

router.get('/config', PaymentController.config);
router.post('/preview', previewPaymentValidator, validate, PaymentController.preview);
// Renewal: authenticated admin. Signup: registrationToken from pending draft.
router.post(
  '/create-order',
  resolvePaymentActor,
  createOrderValidator,
  validate,
  PaymentController.createOrder
);
router.post(
  '/verify',
  resolvePaymentActor,
  verifyPaymentValidator,
  validate,
  PaymentController.verify
);
router.post(
  '/start-trial',
  resolvePaymentActor,
  startTrialValidator,
  validate,
  PaymentController.startTrial
);

module.exports = router;
