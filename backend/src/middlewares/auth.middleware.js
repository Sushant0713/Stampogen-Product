const AppError = require('@utils/AppError');
const { HTTP_STATUS, COOKIE_NAMES } = require('@constants');
const { verifyAccessToken } = require('@utils/token');
const UserRepository = require('@repositories/user.repository');
const { clearAuthCookies } = require('@helpers/cookie.helper');
const { assertAccountAccess } = require('@helpers/accountAccess.helper');

const authenticate = async (req, res, next) => {
  try {
    const token =
      req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return next(new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED));
    }

    const decoded = verifyAccessToken(token);
    const user = await UserRepository.findById(decoded.sub);

    if (!user || !user.isActive) {
      clearAuthCookies(res);
      return next(new AppError('User not found or inactive', HTTP_STATUS.UNAUTHORIZED));
    }

    try {
      assertAccountAccess(user);
    } catch (accessError) {
      clearAuthCookies(res);
      return next(accessError);
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error?.code === 'TENANT_SUSPENDED' || error?.code === 'TENANT_INACTIVE') {
      return next(error);
    }
    return next(new AppError('Invalid or expired token', HTTP_STATUS.UNAUTHORIZED));
  }
};

const optionalAuthenticate = async (req, _res, next) => {
  try {
    const token =
      req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await UserRepository.findById(decoded.sub);
      if (user && user.isActive) {
        try {
          assertAccountAccess(user);
          req.user = user;
        } catch {
          // Suspended/inactive tenants are treated as logged out for optional auth
        }
      }
    }
  } catch {
    // Optional auth - ignore invalid tokens
  }

  return next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
};
