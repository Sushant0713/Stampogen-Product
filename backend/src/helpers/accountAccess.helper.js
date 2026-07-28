const AppError = require('@utils/AppError');
const { HTTP_STATUS, TENANT_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const {
  AFFILIATE_APPROVAL_STATUS,
  isAffiliateApproved,
} = require('@constants/affiliateApproval');

function getRoleSlug(user) {
  return user?.role?.slug || user?.role || null;
}

function getTenantStatus(user) {
  const tenant = user?.tenant;
  if (!tenant || typeof tenant !== 'object') return null;
  return tenant.status || null;
}

function assertAffiliateCanLogin(user, { forLogin = false } = {}) {
  if (getRoleSlug(user) !== ROLES.AFFILIATE) {
    return user;
  }

  const status = user.affiliateApprovalStatus;
  if (isAffiliateApproved(status)) {
    return user;
  }

  const statusCode = forLogin ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.UNAUTHORIZED;
  const messages = {
    [AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW]:
      'Your affiliate application is pending review. We will contact you about the next steps. Login is available only after approval.',
    [AFFILIATE_APPROVAL_STATUS.ON_HOLD]:
      'Your affiliate application is on hold. Please wait for further updates.',
    [AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED]:
      'Your interview is scheduled. Login will be available after the interview decision.',
    [AFFILIATE_APPROVAL_STATUS.REJECTED]:
      'Your affiliate application was not approved. Please contact support.',
  };

  const error = new AppError(
    messages[status] || 'Your affiliate account is not approved for login yet.',
    statusCode
  );
  error.code = 'AFFILIATE_NOT_APPROVED';
  error.affiliateApprovalStatus = status;
  throw error;
}

/**
 * Blocks admin access when their shop/tenant is suspended or inactive.
 * Blocks affiliate login until application is approved.
 */
function assertAccountAccess(user, { forLogin = false } = {}) {
  if (!user) {
    throw new AppError('User not found or inactive', HTTP_STATUS.UNAUTHORIZED);
  }

  assertAffiliateCanLogin(user, { forLogin });

  if (getRoleSlug(user) !== ROLES.ADMIN) {
    return user;
  }

  const status = getTenantStatus(user);
  const statusCode = forLogin ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.UNAUTHORIZED;

  if (status === TENANT_STATUS.SUSPENDED) {
    const error = new AppError(
      'Your account has been suspended. Please contact support.',
      statusCode
    );
    error.code = 'TENANT_SUSPENDED';
    throw error;
  }

  if (status === TENANT_STATUS.INACTIVE) {
    const error = new AppError(
      'Your account is inactive. Please contact support.',
      statusCode
    );
    error.code = 'TENANT_INACTIVE';
    throw error;
  }

  return user;
}

module.exports = {
  assertAccountAccess,
  assertAffiliateCanLogin,
  getTenantStatus,
  getRoleSlug,
};
