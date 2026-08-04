/**
 * Obscure public base path for Super Admin login/register (and related auth pages).
 * Set NEXT_PUBLIC_SUPER_ADMIN_AUTH_PATH (and backend SUPER_ADMIN_AUTH_PATH) to the same slug.
 * Canonical app routes stay under /super-admin/* after login.
 */

const RESERVED_SLUGS = new Set([
  'super-admin',
  'admin',
  'affiliate',
  'app',
  'user',
  'api',
  'checkout',
  'pricing',
  'join',
  'q',
  '_next',
]);

/** Fallback when env is unset — change via env in real deployments. */
export const DEFAULT_SUPER_ADMIN_AUTH_SLUG = 'x7k2m9qp-ops';

export const SUPER_ADMIN_PUBLIC_AUTH_SEGMENTS = [
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
];

export function normalizeSuperAdminAuthSlug(value) {
  const slug = String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,64}$/.test(slug)) {
    return DEFAULT_SUPER_ADMIN_AUTH_SLUG;
  }
  if (RESERVED_SLUGS.has(slug.toLowerCase())) {
    return DEFAULT_SUPER_ADMIN_AUTH_SLUG;
  }
  return slug;
}

export function getSuperAdminAuthSlug() {
  return normalizeSuperAdminAuthSlug(process.env.NEXT_PUBLIC_SUPER_ADMIN_AUTH_PATH);
}

/** e.g. `/x7k2m9qp-ops` */
export function getSuperAdminAuthBasePath() {
  return `/${getSuperAdminAuthSlug()}`;
}

export function isSuperAdminPublicAuthSegment(segment) {
  return SUPER_ADMIN_PUBLIC_AUTH_SEGMENTS.includes(String(segment || ''));
}
