const roleRoutes = require('../../routes/role.routes');
const RoleController = require('../../controllers/role.controller');
const RoleService = require('../../services/role.service');

module.exports = {
  routes: roleRoutes,
  controller: RoleController,
  service: RoleService,
};
