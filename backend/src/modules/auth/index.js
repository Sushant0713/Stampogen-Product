const authRoutes = require('../../routes/auth.routes');
const AuthController = require('../../controllers/auth.controller');
const AuthService = require('../../services/auth.service');

module.exports = {
  routes: authRoutes,
  controller: AuthController,
  service: AuthService,
};
