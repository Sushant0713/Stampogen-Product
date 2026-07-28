const express = require('express');
const DiscountController = require('@controllers/discount.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const {
  createDiscountValidator,
  updateDiscountValidator,
  discountIdValidator,
  bulkDeleteValidator,
} = require('@validators/discount.validator');

const router = express.Router();

router.use(authenticate, isSuperAdmin);

router.get('/stats', DiscountController.getStats);
router.get('/', DiscountController.getAll);
router.post('/', createDiscountValidator, validate, DiscountController.create);
router.post('/bulk-delete', bulkDeleteValidator, validate, DiscountController.removeMany);
router.get('/:id', discountIdValidator, validate, DiscountController.getById);
router.patch('/:id', updateDiscountValidator, validate, DiscountController.update);
router.delete('/:id', discountIdValidator, validate, DiscountController.remove);

module.exports = router;
