require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseExpiresInMs } = require('@utils/token');

test('parseExpiresInMs parses minute/day suffixes', () => {
  assert.equal(parseExpiresInMs('15m'), 15 * 60 * 1000);
  assert.equal(parseExpiresInMs('7d'), 7 * 24 * 60 * 60 * 1000);
  assert.equal(parseExpiresInMs('30s'), 30 * 1000);
  assert.equal(parseExpiresInMs('2h'), 2 * 60 * 60 * 1000);
});

test('parseExpiresInMs treats a number as seconds', () => {
  assert.equal(parseExpiresInMs(3600), 3600 * 1000);
});

test('parseExpiresInMs falls back on unparseable input', () => {
  const fallback = 123456;
  assert.equal(parseExpiresInMs('not-a-duration', fallback), fallback);
});
