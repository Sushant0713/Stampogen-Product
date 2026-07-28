const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const RoleRepository = require('@repositories/role.repository');

class RoleService {
  async getAll() {
    return RoleRepository.findAll();
  }

  async getById(id) {
    const role = await RoleRepository.findById(id);
    if (!role) {
      throw new AppError('Role not found', HTTP_STATUS.NOT_FOUND);
    }
    return role;
  }

  async getBySlug(slug) {
    const role = await RoleRepository.findBySlug(slug);
    if (!role) {
      throw new AppError('Role not found', HTTP_STATUS.NOT_FOUND);
    }
    return role;
  }
}

module.exports = new RoleService();
