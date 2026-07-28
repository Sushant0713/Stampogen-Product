const ROLES = {
  SUPER_ADMIN: 'super-admin',
  ADMIN: 'admin',
  AFFILIATE: 'affiliate',
  USER: 'user',
};

const ROLE_NAMES = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.AFFILIATE]: 'Affiliate',
  [ROLES.USER]: 'User',
};

const AUTHENTICATED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AFFILIATE];

/** Roles allowed on POST /auth/google/:role (includes end-customers). */
const GOOGLE_AUTH_ROLES = [...AUTHENTICATED_ROLES, ROLES.USER];

const DEFAULT_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'],
  [ROLES.ADMIN]: ['tenant:read', 'tenant:update', 'users:manage'],
  [ROLES.AFFILIATE]: ['affiliate:read', 'affiliate:update'],
  [ROLES.USER]: ['profile:read', 'profile:update'],
};

module.exports = {
  ROLES,
  ROLE_NAMES,
  AUTHENTICATED_ROLES,
  GOOGLE_AUTH_ROLES,
  DEFAULT_PERMISSIONS,
};
