const express = require('express');
const RoleController = require('@controllers/role.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isSuperAdmin } = require('@middlewares/authorize.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', isSuperAdmin, RoleController.getAll);
router.get('/:id', isSuperAdmin, RoleController.getById);

module.exports = router;
