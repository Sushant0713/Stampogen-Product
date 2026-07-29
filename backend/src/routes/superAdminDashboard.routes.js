const express = require('express');
const SuperAdminDashboardController = require('@controllers/superAdminDashboard.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');

const router = express.Router();

router.use(authenticate, isSuperAdmin);
router.get('/', SuperAdminDashboardController.get);

module.exports = router;
