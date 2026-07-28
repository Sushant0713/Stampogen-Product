const RoleService = require('@services/role.service');
const { sendSuccess } = require('@utils/response');

class RoleController {
  async getAll(req, res, next) {
    try {
      const roles = await RoleService.getAll();
      return sendSuccess(res, {
        message: 'Roles retrieved',
        data: { roles },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const role = await RoleService.getById(req.params.id);
      return sendSuccess(res, {
        message: 'Role retrieved',
        data: { role },
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new RoleController();
