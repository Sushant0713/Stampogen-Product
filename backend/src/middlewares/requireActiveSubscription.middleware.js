const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const TenantRepository = require('@repositories/tenant.repository');
const {
  getSubscriptionView,
  applyDuePendingPlan,
} = require('@helpers/billing.helper');
const { getRoleSlug } = require('@helpers/accountAccess.helper');

function isExpiredSubscription(subscription) {
  if (!subscription?.planName) return true;
  if (subscription.status === 'trial_expired' || subscription.status === 'expired') {
    return true;
  }
  return subscription.daysRemaining != null && subscription.daysRemaining < 0;
}

function isTrialLock(subscription) {
  if (!subscription?.planName) return false;
  return (
    Boolean(subscription.isTrial) ||
    subscription.source === 'trial' ||
    subscription.status === 'trial_expired'
  );
}

/**
 * Blocks admin facility APIs when free trial or paid plan has ended.
 * Keep off auth/me and payment routes so admins can still upgrade.
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || getRoleSlug(user) !== ROLES.ADMIN) {
      return next();
    }

    const tenantId = user.tenant?._id || user.tenant || null;
    if (!tenantId) {
      const error = new AppError(
        'Choose a plan to continue using Stampogen.',
        HTTP_STATUS.FORBIDDEN
      );
      error.code = 'SUBSCRIPTION_EXPIRED';
      return next(error);
    }

    let tenant =
      user.tenant && typeof user.tenant === 'object' && user.tenant.currentPlan
        ? user.tenant
        : await TenantRepository.findById(tenantId);

    if (!tenant) {
      const error = new AppError(
        'Choose a plan to continue using Stampogen.',
        HTTP_STATUS.FORBIDDEN
      );
      error.code = 'SUBSCRIPTION_EXPIRED';
      return next(error);
    }

    const { tenant: synced, applied } = applyDuePendingPlan(tenant);
    if (applied) {
      await TenantRepository.updateById(tenantId, {
        currentPlan: synced.currentPlan,
        pendingPlan: synced.pendingPlan,
        billingHistory: synced.billingHistory,
        subscriptionSource: synced.subscriptionSource,
        trial: synced.trial,
      });
      tenant = synced;
      if (user.tenant && typeof user.tenant === 'object') {
        req.user.tenant = {
          ...(typeof user.tenant.toObject === 'function' ? user.tenant.toObject() : user.tenant),
          ...synced,
        };
      }
    }

    const subscription = getSubscriptionView(tenant);
    if (!isExpiredSubscription(subscription)) {
      return next();
    }

    const trial = isTrialLock(subscription);
    const error = new AppError(
      trial
        ? 'Your free trial has ended. Upgrade your plan to continue.'
        : 'Your plan has ended. Upgrade your plan to continue.',
      HTTP_STATUS.FORBIDDEN
    );
    error.code = 'SUBSCRIPTION_EXPIRED';
    error.subscription = {
      status: subscription.status,
      planName: subscription.planName,
      isTrial: Boolean(subscription.isTrial),
      daysRemaining: subscription.daysRemaining,
    };
    return next(error);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  requireActiveSubscription,
  isExpiredSubscription,
};
