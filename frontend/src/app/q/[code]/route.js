import { NextResponse } from 'next/server';
import { API_URL } from '@/constants';

function apiBase() {
  const configured = String(API_URL || '/api/v1').replace(/\/$/, '');
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return configured;
  }
  const backend = String(process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
  if (configured.startsWith('/')) {
    return `${backend}${configured}`;
  }
  return `${backend}/${configured}`;
}

export async function GET(request, context) {
  const params = await context.params;
  const code = String(params?.code || '').trim();

  if (!code || !/^[a-zA-Z0-9_-]{4,32}$/.test(code)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const headers = {
      Accept: 'application/json',
    };
    const ua = request.headers.get('user-agent');
    const referer = request.headers.get('referer');
    const forwarded = request.headers.get('x-forwarded-for');
    if (ua) headers['user-agent'] = ua;
    if (referer) headers.referer = referer;
    if (forwarded) headers['x-forwarded-for'] = forwarded;

    const res = await fetch(`${apiBase()}/platform-qr/public/${encodeURIComponent(code)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const json = await res.json();
    const target = json?.data?.url;
    if (!target) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.redirect(target, 302);
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }
}
