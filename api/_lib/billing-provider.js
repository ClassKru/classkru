'use strict';

// Provider-neutral billing boundary.
// Keep payment gateway details behind this contract so the rest of ClassKru
// only handles orders, events, and entitlements. The test provider never
// contacts a bank or creates a real charge.

const BILLING_MODES = Object.freeze({ TEST: 'test', LIVE: 'live' });
const PAYMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  EXPIRED: 'expired',
  REFUNDED: 'refunded'
});

function billingMode(env = process.env) {
  return env.BILLING_MODE === BILLING_MODES.LIVE ? BILLING_MODES.LIVE : BILLING_MODES.TEST;
}

function createTestProvider() {
  return Object.freeze({
    name: 'test',
    async createPayment(order) {
      return {
        provider: 'test',
        status: PAYMENT_STATUSES.PENDING,
        orderId: order.id,
        externalReference: `test_${order.id}`,
        qrPayload: null,
        expiresAt: null
      };
    },
    async verifyEvent() {
      return { accepted: false, reason: 'test_provider_does_not_verify_real_payments' };
    }
  });
}

function getBillingProvider(env = process.env) {
  // Live providers should be added here only after credentials, webhook
  // signature verification, duplicate-event handling, and reconciliation are ready.
  if (billingMode(env) === BILLING_MODES.LIVE) {
    throw new Error('LIVE_BILLING_PROVIDER_NOT_CONFIGURED');
  }
  return createTestProvider();
}

module.exports = { BILLING_MODES, PAYMENT_STATUSES, billingMode, createTestProvider, getBillingProvider };
