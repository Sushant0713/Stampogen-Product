const rateLimit = require('express-rate-limit');
const config = require('@config');

const isDev = config.env === 'development';

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  // Local SPA traffic (auth/me, plans, checkout) easily exceeds tight limits
  skip: (req) => isDev || req.path === '/api/v1/health' || req.path === '/health',
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
};
