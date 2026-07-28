const express = require('express');
const authRoutes = require('./auth.routes');
const roleRoutes = require('./role.routes');
const tenantRoutes = require('./tenant.routes');
const userRoutes = require('./user.routes');
const discountRoutes = require('./discount.routes');
const featureRoutes = require('./feature.routes');
const planRoutes = require('./plan.routes');
const invoiceSettingsRoutes = require('./invoiceSettings.routes');
const paymentRoutes = require('./payment.routes');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/tenants', tenantRoutes);
router.use('/users', userRoutes);
router.use('/discounts', discountRoutes);
router.use('/features', featureRoutes);
router.use('/plans', planRoutes);
router.use('/invoice-settings', invoiceSettingsRoutes);
router.use('/agreement-settings', require('./agreementSettings.routes'));
router.use('/affiliate-settings', require('./affiliateSettings.routes'));
router.use('/affiliate-onboarding', require('./affiliateOnboarding.routes'));
router.use('/affiliate-earnings', require('./affiliateEarnings.routes'));
router.use('/payments', paymentRoutes);
router.use('/notifications', require('./notification.routes'));
router.use('/loyalty', require('./loyalty.routes'));

module.exports = router;
