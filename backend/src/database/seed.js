require('../config/aliases');

const { connectDatabase } = require('@database/connection');
const RoleRepository = require('@repositories/role.repository');
const { ROLES, ROLE_NAMES, DEFAULT_PERMISSIONS } = require('@constants/roles');

const seedRoles = async () => {
  await connectDatabase();

  const roles = Object.values(ROLES).map((slug) => ({
    name: ROLE_NAMES[slug],
    slug,
    permissions: DEFAULT_PERMISSIONS[slug],
  }));

  for (const role of roles) {
    const result = await RoleRepository.findOrCreate(role);
    console.info(`Role ready: ${result.slug}`);
  }

  console.info('Seed completed');
  process.exit(0);
};

seedRoles().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
