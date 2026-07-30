/**
 * Marketing vs app host URLs (build-time NEXT_PUBLIC_*).
 *
 * Production example:
 *   NEXT_PUBLIC_MARKETING_URL=https://stampogen.in
 *   NEXT_PUBLIC_APP_URL=https://app.stampogen.in
 *
 * Change those env values and rebuild to update Home / About / Affiliate / Login / join.
 */

function trimSlash(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

function abs(base, path = '/') {
  const root = trimSlash(base);
  if (!root) return path === '/' ? '#' : path;
  if (!path || path === '/') return root;
  return `${root}${path.startsWith('/') ? path : `/${path}`}`;
}

const APP_BASE = trimSlash(process.env.NEXT_PUBLIC_APP_URL || '');
const MARKETING_BASE = trimSlash(process.env.NEXT_PUBLIC_MARKETING_URL || '');

export const MARKETING_SITE_URL = MARKETING_BASE;
export const APP_SITE_URL = APP_BASE;

export const MARKETING_LINKS = {
  /** https://stampogen.in/ */
  home: MARKETING_BASE ? abs(MARKETING_BASE, '/') : '#',
  /** https://stampogen.in/about */
  about: MARKETING_BASE ? abs(MARKETING_BASE, '/about') : '#',
  /** Pricing lives on the app host */
  pricing: '/pricing',
  /** https://stampogen.in/affiliate */
  affiliate: MARKETING_BASE ? abs(MARKETING_BASE, '/affiliate') : '#',
  /** https://app.stampogen.in/ */
  shopOwnerLogin: APP_BASE ? abs(APP_BASE, '/') : '/admin/login',
  startFree: '/admin/register',
  earlyAccess: '/admin/register',
  talkToUs: 'mailto:hello@stampogen.com',
};

/** Absolute join URL for a tenant (uses APP_URL; browser prefers current origin). */
export function marketingJoinUrl(tenantSlug) {
  const slug = String(tenantSlug || '').trim();
  if (!slug) return '';
  return abs(APP_BASE || 'http://localhost:3000', `/join/${slug}`);
}
