const tenantRoutes = require('../../routes/tenant.routes');
const TenantController = require('../../controllers/tenant.controller');
const TenantService = require('../../services/tenant.service');

module.exports = {
  routes: tenantRoutes,
  controller: TenantController,
  service: TenantService,
};
