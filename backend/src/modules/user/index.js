const userRoutes = require('../../routes/user.routes');
const UserController = require('../../controllers/user.controller');
const UserService = require('../../services/user.service');

module.exports = {
  routes: userRoutes,
  controller: UserController,
  service: UserService,
};
