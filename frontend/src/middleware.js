import { NextResponse } from 'next/server';

const DEFAULT_SA_AUTH_SLUG = 'x7k2m9qp-ops';
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

const SA_AUTH_SEGMENTS = new Set([
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
]);

const PROTECTED_PREFIXES = ['/super-admin/dashboard', '/admin/dashboard', '/affiliate/dashboard'];

const ROLE_AUTH_PAGES = [
  '/admin/login',
  '/admin/register',
  '/admin/verify-email',
  '/affiliate/login',
  '/affiliate/register',
  '/affiliate/verify-email',
];

function getSuperAdminAuthSlug() {
  const raw = String(process.env.NEXT_PUBLIC_SUPER_ADMIN_AUTH_PATH || DEFAULT_SA_AUTH_SLUG)
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,64}$/.test(raw)) return DEFAULT_SA_AUTH_SLUG;
  if (RESERVED_SLUGS.has(raw.toLowerCase())) return DEFAULT_SA_AUTH_SLUG;
  return raw;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const hasSession = Boolean(accessToken || refreshToken);
  const saSlug = getSuperAdminAuthSlug();

  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0] || '';
  const second = segments[1] || '';

  // Obscure public SA auth URLs → internal /super-admin/* (browser URL stays obscure)
  if (first === saSlug && SA_AUTH_SEGMENTS.has(second) && segments.length === 2) {
    if (hasSession && accessToken && ['login', 'register', 'verify-email'].includes(second)) {
      return NextResponse.redirect(new URL('/super-admin/dashboard', request.url));
    }
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/super-admin/${second}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  // Hide guessable /super-admin/login|register|...
  if (first === 'super-admin' && SA_AUTH_SEGMENTS.has(second) && segments.length === 2) {
    return NextResponse.rewrite(new URL('/_not-found', request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((path) => pathname.startsWith(path));
  const isSaAuthPage =
    first === saSlug && SA_AUTH_SEGMENTS.has(second) && segments.length === 2;
  const isAuthPage = ROLE_AUTH_PAGES.includes(pathname) || isSaAuthPage;

  if (isProtected && !hasSession) {
    const role = pathname.split('/')[1];
    const loginPath = role === 'super-admin' ? `/${saSlug}/login` : `/${role}/login`;
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && hasSession && accessToken) {
    if (pathname === '/admin/register') {
      const plan = request.nextUrl.searchParams.get('plan');
      if (plan) {
        const checkoutUrl = new URL('/checkout', request.url);
        checkoutUrl.searchParams.set('plan', plan);
        return NextResponse.redirect(checkoutUrl);
      }
    }
    const dashboardRole = first === saSlug ? 'super-admin' : first;
    return NextResponse.redirect(new URL(`/${dashboardRole}/dashboard`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/super-admin/:path*',
    '/admin/:path*',
    '/affiliate/:path*',
    '/:authSlug/login',
    '/:authSlug/register',
    '/:authSlug/forgot-password',
    '/:authSlug/reset-password',
    '/:authSlug/verify-email',
  ],
};
