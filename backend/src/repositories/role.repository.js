const { Role } = require('@models');

class RoleRepository {
  async findBySlug(slug) {
    return Role.findOne({ slug });
  }

  async findById(id) {
    return Role.findById(id);
  }

  async findAll() {
    return Role.find().sort({ name: 1 });
  }

  async create(data) {
    return Role.create(data);
  }

  async findOrCreate(data) {
    let role = await this.findBySlug(data.slug);
    if (!role) {
      role = await this.create(data);
    }
    return role;
  }

  async updateById(id, data) {
    return Role.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return Role.findByIdAndDelete(id);
  }
}

module.exports = new RoleRepository();
