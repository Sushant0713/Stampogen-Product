import { NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/super-admin/dashboard', '/admin/dashboard', '/affiliate/dashboard'];

const AUTH_PAGES = [
  '/super-admin/login',
  '/super-admin/register',
  '/super-admin/verify-email',
  '/admin/login',
  '/admin/register',
  '/admin/verify-email',
  '/affiliate/login',
  '/affiliate/register',
  '/affiliate/verify-email',
];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const hasSession = Boolean(accessToken || refreshToken);

  const isProtected = PROTECTED_PREFIXES.some((path) => pathname.startsWith(path));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isProtected && !hasSession) {
    const role = pathname.split('/')[1];
    const loginUrl = new URL(`/${role}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && hasSession && accessToken) {
    const role = pathname.split('/')[1];
    // Pricing funnel: already signed-in admin with a plan should pay, not land on dashboard
    if (pathname === '/admin/register') {
      const plan = request.nextUrl.searchParams.get('plan');
      if (plan) {
        const checkoutUrl = new URL('/checkout', request.url);
        checkoutUrl.searchParams.set('plan', plan);
        return NextResponse.redirect(checkoutUrl);
      }
    }
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/super-admin/:path*', '/admin/:path*', '/affiliate/:path*'],
};
