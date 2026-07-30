/**
 * Marketing vs app host URLs (build-time NEXT_PUBLIC_*).
 *
 * Production:
 *   NEXT_PUBLIC_MARKETING_URL=https://stampogen.in
 *   NEXT_PUBLIC_APP_URL=https://app.stampogen.in
 *
 * Change those env values and rebuild to update Home / About / Affiliate / Login / join.
 * If MARKETING_URL is omitted, defaults to https://stampogen.in so nav links still work.
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

const DEFAULT_MARKETING_URL = 'https://stampogen.in';
const DEFAULT_APP_URL = 'https://app.stampogen.in';

const APP_BASE = trimSlash(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL);
const MARKETING_BASE = trimSlash(
  process.env.NEXT_PUBLIC_MARKETING_URL || DEFAULT_MARKETING_URL
);

export const MARKETING_SITE_URL = MARKETING_BASE;
export const APP_SITE_URL = APP_BASE;

export const MARKETING_LINKS = {
  /** https://stampogen.in/ */
  home: abs(MARKETING_BASE, '/'),
  /** https://stampogen.in/about */
  about: abs(MARKETING_BASE, '/about'),
  /** Pricing lives on the app host */
  pricing: '/pricing',
  /** https://stampogen.in/affiliate */
  affiliate: abs(MARKETING_BASE, '/affiliate'),
  /** https://app.stampogen.in/ */
  shopOwnerLogin: abs(APP_BASE, '/'),
  startFree: '/admin/register',
  earlyAccess: '/admin/register',
  talkToUs: 'mailto:hello@stampogen.com',
};

/** Absolute join URL for a tenant (uses APP_URL; browser prefers current origin). */
export function marketingJoinUrl(tenantSlug) {
  const slug = String(tenantSlug || '').trim();
  if (!slug) return '';
  return abs(APP_BASE, `/join/${slug}`);
}
