const express = require('express');
const InvoiceSettingsController = require('@controllers/invoiceSettings.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');

const router = express.Router();

router.use(authenticate, isSuperAdmin);

router.get('/', InvoiceSettingsController.get);
router.put('/', InvoiceSettingsController.upsert);

module.exports = router;
