const { body } = require('express-validator');

const previewPaymentValidator = [
  body('planId').optional().isMongoId().withMessage('Invalid plan id'),
  body('planCode').optional().trim().notEmpty().withMessage('Plan code is required'),
  body('discountCode').optional().trim().isLength({ max: 40 }),
  body('customerEmail').optional().trim().isEmail().withMessage('Valid email is required'),
  body('customerGstin').optional().trim().isLength({ max: 20 }),
  body('customerState').optional().trim().isLength({ max: 100 }),
  body('chargeGst').optional().isBoolean().withMessage('chargeGst must be a boolean').toBoolean(),
  body('quantity').optional().isInt({ min: 1, max: 50 }).withMessage('Quantity must be 1–50'),
  body().custom((_, { req }) => {
    if (!req.body.planId && !req.body.planCode) {
      throw new Error('Plan id or code is required');
    }
    return true;
  }),
];

const createOrderValidator = [
  body('planId').optional().isMongoId().withMessage('Invalid plan id'),
  body('planCode').optional().trim().notEmpty().withMessage('Plan code is required'),
  body('discountCode').optional().trim().isLength({ max: 40 }),
  body('customerName').trim().notEmpty().withMessage('Name is required'),
  body('customerEmail').optional({ values: 'falsy' }).trim().isEmail().withMessage('Valid email is required'),
  body('customerPhone').optional().trim().isLength({ max: 20 }),
  body('customerGstin').optional().trim().isLength({ max: 20 }),
  body('customerState').optional().trim().isLength({ max: 100 }),
  body('registrationToken').optional().trim().isLength({ min: 16, max: 128 }),
  body('renewOutletTenantId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid outlet id'),
  body('quantity').optional().isInt({ min: 1, max: 50 }).withMessage('Quantity must be 1–50'),
  body().custom((_, { req }) => {
    if (!req.body.planId && !req.body.planCode) {
      throw new Error('Plan id or code is required');
    }
    return true;
  }),
];

const verifyPaymentValidator = [
  body('paymentId').isMongoId().withMessage('Invalid payment id'),
  body('razorpay_order_id').optional().isString(),
  body('razorpay_payment_id').optional().isString(),
  body('razorpay_signature').optional().isString(),
  body('registrationToken').optional().trim().isLength({ min: 16, max: 128 }),
];

const startTrialValidator = [
  body('registrationToken').trim().notEmpty().withMessage('Registration token is required').isLength({
    min: 16,
    max: 128,
  }),
  body('discountCode').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
];

module.exports = {
  previewPaymentValidator,
  createOrderValidator,
  verifyPaymentValidator,
  startTrialValidator,
};
