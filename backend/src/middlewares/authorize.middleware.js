const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');

const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user || !req.user.role) {
      return next(new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED));
    }

    const userRole = req.user.role.slug;

    if (!allowedRoles.includes(userRole)) {
      return next(new AppError('Insufficient permissions', HTTP_STATUS.FORBIDDEN));
    }

    return next();
  };
};

const authorizePermissions = (...requiredPermissions) => {
  return (req, _res, next) => {
    if (!req.user || !req.user.role) {
      return next(new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED));
    }

    const permissions = req.user.role.permissions || [];

    if (permissions.includes('*')) {
      return next();
    }

    const hasPermission = requiredPermissions.every((perm) => permissions.includes(perm));

    if (!hasPermission) {
      return next(new AppError('Insufficient permissions', HTTP_STATUS.FORBIDDEN));
    }

    return next();
  };
};

const isSuperAdmin = authorize(ROLES.SUPER_ADMIN);
const isAdmin = authorize(ROLES.ADMIN);
const isAffiliate = authorize(ROLES.AFFILIATE);
const isAdminOrSuperAdmin = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN);
const isCustomer = authorize(ROLES.USER);

module.exports = {
  authorize,
  authorizePermissions,
  isSuperAdmin,
  isAdmin,
  isAffiliate,
  isAdminOrSuperAdmin,
  isCustomer,
};
