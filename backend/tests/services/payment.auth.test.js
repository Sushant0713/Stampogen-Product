require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');

const AppError = require('@utils/AppError');
const PaymentService = require('@services/payment.service');
const PaymentRepository = require('@repositories/payment.repository');
const PlanRepository = require('@repositories/plan.repository');
const UserRepository = require('@repositories/user.repository');
const InvoiceSettingsService = require('@services/invoiceSettings.service');

/** Restore any singleton methods a test swapped out. */
function withStubs(stubs, run) {
  const originals = stubs.map(([obj, key]) => [obj, key, obj[key]]);
  stubs.forEach(([obj, key, fn]) => {
    obj[key] = fn;
  });
  return Promise.resolve()
    .then(run)
    .finally(() => {
      originals.forEach(([obj, key, fn]) => {
        obj[key] = fn;
      });
    });
}

test('createOrder rejects when there is no authenticated user (401)', async () => {
  await assert.rejects(
    () => PaymentService.createOrder({ planCode: 'starter' }, null),
    (err) => err instanceof AppError && err.statusCode === 401
  );
});

test('createOrder rejects when the user has no email (401)', async () => {
  await assert.rejects(
    () => PaymentService.createOrder({ planCode: 'starter' }, { firstName: 'A' }),
    (err) => err.statusCode === 401
  );
});

test('createOrder binds the payment to the authenticated email, ignoring the body email', async () => {
  const captured = {};
  await withStubs(
    [
      [PlanRepository, 'findById', async () => null],
      [
        PlanRepository,
        'findByCode',
        async () => ({
          _id: 'plan1',
          name: 'Starter',
          code: 'starter',
          billing: 'Monthly',
          priceAmount: 1000,
          enabled: true,
          status: 'Active',
          visibleWebsite: true,
          priceCustom: false,
        }),
      ],
      // tax context lookup — no tenant found
      [UserRepository, 'findByEmail', async () => null],
      [InvoiceSettingsService, 'get', async () => ({ defaults: { taxMode: 'igst', igstRate: 0 }, company: {} })],
      // Stop right after the payment doc is built, so we never reach Razorpay/network.
      [
        PaymentRepository,
        'create',
        async (doc) => {
          Object.assign(captured, doc);
          throw new AppError('__STOP__', 499);
        },
      ],
    ],
    async () => {
      await assert.rejects(
        () =>
          PaymentService.createOrder(
            { planCode: 'starter', customerEmail: 'attacker@evil.com', customerName: 'X' },
            { email: 'Owner@Example.com', firstName: 'Real', lastName: 'Owner' }
          ),
        (err) => err.statusCode === 499
      );
    }
  );

  assert.equal(captured.customerEmail, 'owner@example.com'); // authed email, normalized
  assert.notEqual(captured.customerEmail, 'attacker@evil.com');
});

test('verify rejects a payment that belongs to a different account (403)', async () => {
  await withStubs(
    [
      [
        PaymentRepository,
        'findById',
        async () => ({
          _id: 'pay1',
          customerEmail: 'owner@example.com',
          status: 'created',
          payableAmount: 500,
        }),
      ],
    ],
    async () => {
      await assert.rejects(
        () => PaymentService.verify({ paymentId: 'pay1' }, { email: 'attacker@example.com' }),
        (err) => err.statusCode === 403
      );
    }
  );
});

test('verify lets the owner past the ownership gate (fails later on missing signature, 400)', async () => {
  await withStubs(
    [
      [
        PaymentRepository,
        'findById',
        async () => ({
          _id: 'pay1',
          customerEmail: 'owner@example.com',
          status: 'created',
          payableAmount: 500,
        }),
      ],
    ],
    async () => {
      await assert.rejects(
        () => PaymentService.verify({ paymentId: 'pay1' }, { email: 'Owner@Example.com' }),
        (err) => err.statusCode === 400 // past 403 ownership → missing Razorpay details
      );
    }
  );
});
