/** @type {import('next').NextConfig} */

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

function getSuperAdminAuthSlug() {
  const raw = String(process.env.NEXT_PUBLIC_SUPER_ADMIN_AUTH_PATH || DEFAULT_SA_AUTH_SLUG)
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,64}$/.test(raw)) return DEFAULT_SA_AUTH_SLUG;
  if (RESERVED_SLUGS.has(raw.toLowerCase())) return DEFAULT_SA_AUTH_SLUG;
  return raw;
}

const saAuthSlug = getSuperAdminAuthSlug();
const saAuthPages = [
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async redirects() {
    // Hide guessable /super-admin auth URLs (public entry is /{saAuthSlug}/...)
    return saAuthPages.map((page) => ({
      source: `/super-admin/${page}`,
      destination: '/_not-found',
      permanent: false,
    }));
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const saAuthRewrites = saAuthPages.map((page) => ({
      source: `/${saAuthSlug}/${page}`,
      destination: `/super-admin/${page}`,
    }));

    return [
      ...saAuthRewrites,
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
