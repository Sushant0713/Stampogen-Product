const express = require('express');
const OutletController = require('@controllers/outlet.controller');
const { authenticate } = require('@middlewares/auth.middleware');
const { isAdmin } = require('@middlewares/authorize.middleware');
const { requireActiveSubscription } = require('@middlewares/requireActiveSubscription.middleware');
const validate = require('@middlewares/validate.middleware');
const { createOutletValidator } = require('@validators/outlet.validator');

const router = express.Router();

router.use(authenticate, isAdmin, requireActiveSubscription);

router.get('/dashboard', OutletController.dashboard);
router.get('/seats', OutletController.listSeats);
router.post('/', createOutletValidator, validate, OutletController.create);

module.exports = router;
