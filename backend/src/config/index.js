require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/stampogen',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '365d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '3650d',
  },
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    httpOnly: true,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:3000/api/v1/auth/google/callback',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Stampogen <noreply@stampogen.local>',
  },
  otp: {
    length: 6,
    expiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 10,
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
  },
  /** Required on Super Admin login (password + Google). Set in env — never commit the real value. */
  superAdminSecretCode: String(process.env.SUPER_ADMIN_SECRET_CODE || '').trim(),
  /**
   * Public URL slug for Super Admin login/register (must match frontend
   * NEXT_PUBLIC_SUPER_ADMIN_AUTH_PATH). Dashboard stays under /super-admin.
   */
  superAdminAuthPath: String(process.env.SUPER_ADMIN_AUTH_PATH || 'x7k2m9qp-ops')
    .trim()
    .replace(/^\/+|\/+$/g, '') || 'x7k2m9qp-ops',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 100,
  },
};

module.exports = config;
