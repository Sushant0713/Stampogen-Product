const { Tenant, User } = require('@models');
const { TENANT_STATUS } = require('@constants');

class TenantRepository {
  async findById(id) {
    return Tenant.findById(id).populate('owner');
  }

  async findBySlug(slug) {
    return Tenant.findOne({ slug }).populate('owner');
  }

  async create(data) {
    const created = await Tenant.create(data);
    const populated = await this.findById(created._id);
    return populated || created;
  }

  async existsById(id) {
    if (!id) return false;
    const count = await Tenant.countDocuments({ _id: id });
    return count > 0;
  }

  async findOrphansNeedingRepair() {
    const { User, Role } = require('@models');
    const adminRole = await Role.findOne({ slug: 'admin' }).lean();
    if (!adminRole) return [];

    const admins = await User.find({
      role: adminRole._id,
      isEmailVerified: true,
      isActive: true,
    })
      .select('firstName lastName email tenant isEmailVerified isActive')
      .lean();

    const tenantIds = admins.map((admin) => admin.tenant).filter(Boolean);
    const existingTenants = tenantIds.length
      ? await Tenant.find({ _id: { $in: tenantIds } }).select('_id').lean()
      : [];
    const existingSet = new Set(existingTenants.map((tenant) => String(tenant._id)));

    const orphans = [];
    for (const admin of admins) {
      if (!admin.tenant) {
        orphans.push({ admin, missingTenant: true, staleTenantId: null });
        continue;
      }
      if (!existingSet.has(String(admin.tenant))) {
        orphans.push({ admin, missingTenant: true, staleTenantId: admin.tenant });
      }
    }
    return orphans;
  }

  async updateById(id, data) {
    return Tenant.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('owner');
  }

  async findAll(filter = {}, options = {}) {
    const { page = 1, limit = 20, sort = '-createdAt', search = '' } = options;
    const skip = (page - 1) * limit;

    const query = { ...filter };

    if (search) {
      const users = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');

      const ownerIds = users.map((user) => user._id);

      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        ...(ownerIds.length ? [{ owner: { $in: ownerIds } }] : []),
      ];
    }

    const [tenants, total] = await Promise.all([
      Tenant.find(query).populate('owner').sort(sort).skip(skip).limit(limit),
      Tenant.countDocuments(query),
    ]);

    return {
      tenants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit) || 1),
      },
    };
  }

  async getStats() {
    const [total, active, suspended] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ status: TENANT_STATUS.ACTIVE }),
      Tenant.countDocuments({ status: TENANT_STATUS.SUSPENDED }),
    ]);

    return {
      totalClients: total,
      active,
      suspended,
      activeSubscriptions: active,
    };
  }

  async deleteById(id) {
    return Tenant.findByIdAndDelete(id);
  }
}

module.exports = new TenantRepository();
