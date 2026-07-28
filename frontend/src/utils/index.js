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
