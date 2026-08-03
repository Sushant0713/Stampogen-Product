import { clsx } from 'clsx';
import { ROLES } from '@/constants';

export function cn(...inputs) {
  return clsx(inputs);
}

export function getErrorMessage(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    fallback
  );
}

export function getRoleSlug(user) {
  return user?.role?.slug || user?.role || null;
}

/** Admin + Outlet Admin share `/admin/login` (also available at `/`). Customers use `/user/login`. */
export function getLoginPath(role) {
  if (role === ROLES.ADMIN) return '/admin/login';
  if (role === ROLES.USER) return '/user/login';
  return `/${role}/login`;
}

export function getCustomerAppPath() {
  return '/app';
}

export function getRegisterPath(role) {
  return `/${role}/register`;
}

export function getForgotPasswordPath(role) {
  return `/${role}/forgot-password`;
}

export function getResetPasswordPath(role, email) {
  const base = `/${role}/reset-password`;
  if (!email) return base;
  return `${base}?email=${encodeURIComponent(email)}`;
}

/** Reject open redirects (protocol-relative / absolute URLs). */
export function isSafeAppRedirect(path) {
  if (!path || typeof path !== 'string') return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  return true;
}

export function adminHasActivePlan(user) {
  const sub = user?.subscription || user?.tenant?.subscription;
  return Boolean(sub?.planName);
}

/** True when free trial or paid plan has ended (or no plan at all). */
export function adminSubscriptionIsLocked(user) {
  return getAdminSubscriptionLock(user).locked;
}

/**
 * Access lock for admin portal facilities after trial/plan end.
 * @returns {{ locked: boolean, reason: 'none'|'trial'|'plan'|null, subscription: object|null }}
 */
export function getAdminSubscriptionLock(user) {
  const sub = user?.subscription || user?.tenant?.subscription || null;
  if (!sub?.planName) {
    return { locked: true, reason: 'none', subscription: sub };
  }

  const days = sub.daysRemaining;
  const expiredByStatus = sub.status === 'trial_expired' || sub.status === 'expired';
  const expiredByDays = days != null && days < 0;
  if (!expiredByStatus && !expiredByDays) {
    return { locked: false, reason: null, subscription: sub };
  }

  const isTrial =
    sub.isTrial ||
    sub.source === 'trial' ||
    sub.status === 'trial_expired' ||
    ['trial_active', 'trial_expiring_soon'].includes(sub.status);

  return {
    locked: true,
    reason: isTrial ? 'trial' : 'plan',
    subscription: sub,
  };
}

/** Routes still usable while the upgrade gate is up. */
export function isAdminUpgradeAllowedPath(pathname = '') {
  const path = String(pathname || '').split('?')[0];
  return (
    path === '/admin/plans/browse' ||
    path === '/admin/plans/my' ||
    path.startsWith('/admin/plans/browse/') ||
    path.startsWith('/admin/plans/my/') ||
    path.startsWith('/admin/plans/outlet/') ||
    path === '/admin/outlets' ||
    path.startsWith('/admin/outlets/')
  );
}

/** Checkout URL for an admin finishing / starting a plan purchase. */
export function getAdminCheckoutPath({ planCode, discountCode } = {}) {
  if (!planCode) return null;
  const params = new URLSearchParams({ plan: String(planCode) });
  if (discountCode) params.set('discount', String(discountCode));
  return `/checkout?${params.toString()}`;
}

/** Unpaid / unfinished admins: checkout if plan known, else browse plans. */
export function getAdminFinishPaymentPath({ planCode, discountCode } = {}) {
  return getAdminCheckoutPath({ planCode, discountCode }) || '/admin/plans/browse';
}

export function getLoginWithRedirectPath(role, redirect) {
  const base = getLoginPath(role);
  if (!isSafeAppRedirect(redirect)) return base;
  const join = base.includes('?') ? '&' : '?';
  return `${base}${join}redirect=${encodeURIComponent(redirect)}`;
}

/**
 * Where to send the user after login / Google sign-in.
 * Prefer safe ?redirect=; unpaid admins cannot log in (blocked server-side).
 */
export function resolvePostAuthPath({ role, user, redirect } = {}) {
  if (isSafeAppRedirect(redirect)) return redirect;
  if (role === ROLES.ADMIN && user) {
    const lock = getAdminSubscriptionLock(user);
    if (lock.locked && lock.reason !== 'none') {
      return '/admin/plans/browse';
    }
    if (!adminHasActivePlan(user)) {
      return '/pricing';
    }
  }
  if (role === ROLES.USER) return '/app';
  return `/${role}/dashboard`;
}

export function navigateAfterAuth(router, path) {
  const next = String(path || '').trim() || '/';
  if (
    next.startsWith('/checkout') ||
    next.startsWith('/pricing') ||
    next.includes('/verify-email') ||
    next.startsWith('/admin/plans/')
  ) {
    window.location.assign(next);
    return;
  }
  router.push(next);
}
