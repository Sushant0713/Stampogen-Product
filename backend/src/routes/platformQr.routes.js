const express = require('express');
const PlatformQrController = require('@controllers/platformQr.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');
const validate = require('@middlewares/validate.middleware');
const {
  createPlatformQrValidator,
  updatePlatformQrValidator,
  platformQrIdValidator,
  platformQrCodeValidator,
  platformQrReportsValidator,
} = require('@validators/platformQr.validator');

const router = express.Router();

// Public scan tracking (no auth)
router.get(
  '/public/:code',
  platformQrCodeValidator,
  validate,
  PlatformQrController.visit
);
router.get(
  '/public/:code/go',
  platformQrCodeValidator,
  validate,
  PlatformQrController.go
);

router.use(authenticate, isSuperAdmin);

router.get('/reports', platformQrReportsValidator, validate, PlatformQrController.reports);
router.get('/options', PlatformQrController.options);
router.get('/', PlatformQrController.list);
router.post('/', createPlatformQrValidator, validate, PlatformQrController.create);
router.get('/:id', platformQrIdValidator, validate, PlatformQrController.getById);
router.patch('/:id', updatePlatformQrValidator, validate, PlatformQrController.update);
router.delete('/:id', platformQrIdValidator, validate, PlatformQrController.remove);

module.exports = router;
