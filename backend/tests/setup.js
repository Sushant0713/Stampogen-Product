/**
 * Shared test bootstrap: sets safe defaults BEFORE any app module loads,
 * then registers the `@`-style module aliases so tests can require app code.
 * Require this first in every test file: require('../setup');
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test_access_secret_min_32_characters_long';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_min_32_characters_long';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

require('../src/config/aliases');
