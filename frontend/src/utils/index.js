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

/** Admin login lives at `/`; other roles use `/{role}/login`. Customers use `/user/login`. */
export function getLoginPath(role) {
  if (role === ROLES.ADMIN) return '/';
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
  if (role === ROLES.ADMIN && user && !adminHasActivePlan(user)) {
    return '/pricing';
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
