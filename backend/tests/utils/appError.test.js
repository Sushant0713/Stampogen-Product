require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('@utils/AppError');

test('AppError carries status code and marks 4xx as fail', () => {
  const err = new AppError('bad request', 400);
  assert.equal(err.statusCode, 400);
  assert.equal(err.status, 'fail');
  assert.equal(err.isOperational, true);
  assert.ok(err instanceof Error);
});

test('AppError defaults to 500 / error', () => {
  const err = new AppError('boom');
  assert.equal(err.statusCode, 500);
  assert.equal(err.status, 'error');
});
