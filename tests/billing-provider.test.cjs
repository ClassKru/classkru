const assert = require('node:assert/strict');
const test = require('node:test');
const {
  BILLING_MODES,
  PAYMENT_STATUSES,
  billingMode,
  getBillingProvider
} = require('../api/_lib/billing-provider');

test('billing defaults to the safe test mode', async () => {
  assert.equal(billingMode({}), BILLING_MODES.TEST);
  const provider = getBillingProvider({});
  const result = await provider.createPayment({ id: 'order-test-1' });
  assert.equal(result.status, PAYMENT_STATUSES.PENDING);
  assert.equal(result.qrPayload, null);
});

test('live mode refuses to run without a configured provider', () => {
  assert.throws(() => getBillingProvider({ BILLING_MODE: 'live' }), /LIVE_BILLING_PROVIDER_NOT_CONFIGURED/);
});
