const express = require('express');
const PlatformInvoiceController = require('@controllers/platformInvoice.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const {
  platformInvoiceIdValidator,
  bulkDeletePlatformInvoiceValidator,
} = require('@validators/platformInvoice.validator');

const router = express.Router();

router.use(authenticate, isSuperAdmin);

router.get('/stats', PlatformInvoiceController.getStats);
router.get('/filter-options', PlatformInvoiceController.getFilterOptions);
router.post(
  '/bulk-delete',
  bulkDeletePlatformInvoiceValidator,
  validate,
  PlatformInvoiceController.removeMany
);
router.get('/:id/pdf', platformInvoiceIdValidator, validate, PlatformInvoiceController.getPdf);
router.get('/:id', platformInvoiceIdValidator, validate, PlatformInvoiceController.getById);
router.delete('/:id', platformInvoiceIdValidator, validate, PlatformInvoiceController.remove);
router.get('/', PlatformInvoiceController.list);

module.exports = router;
