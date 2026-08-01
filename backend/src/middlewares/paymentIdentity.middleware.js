const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const { optionalAuthenticate } = require('@middlewares/auth.middleware');
const PendingAdminRegistrationRepository = require('@repositories/pendingAdminRegistration.repository');

/**
 * Checkout identity: authenticated admin (renewal) OR registration token (new signup).
 */
function resolvePaymentActor(req, res, next) {
  optionalAuthenticate(req, res, () => {
    Promise.resolve()
      .then(async () => {
        const token = String(
          req.body?.registrationToken || req.headers['x-registration-token'] || ''
        ).trim();

        if (token) {
          const pending = await PendingAdminRegistrationRepository.findByValidToken(token);
          if (!pending) {
            throw new AppError(
              'Registration session expired. Please register again.',
              HTTP_STATUS.UNAUTHORIZED
            );
          }
          req.pendingRegistration = pending;
          req.registrationToken = token;
          return;
        }

        if (!req.user) {
          throw new AppError('Authentication required', HTTP_STATUS.UNAUTHORIZED);
        }

        const roleSlug = req.user.role?.slug || req.user.role;
        if (roleSlug !== ROLES.ADMIN) {
          throw new AppError('Insufficient permissions', HTTP_STATUS.FORBIDDEN);
        }
      })
      .then(() => next())
      .catch((error) => next(error));
  });
}

module.exports = {
  resolvePaymentActor,
};
