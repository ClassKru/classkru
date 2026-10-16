'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeQuota } = require('../api/_lib/ai-quota');

test('new teachers see the full daily quota when RPC values are null', () => {
  const quota = normalizeQuota({ allowed: true, date: '2026-10-16', limit: 15, used: null, remaining: null });

  assert.deepEqual(quota, {
    allowed: true,
    date: '2026-10-16',
    limit: 15,
    used: 0,
    remaining: 15
  });
});

test('quota normalization derives remaining from a valid used count when missing', () => {
  const quota = normalizeQuota({ allowed: true, date: '2026-10-16', limit: 15, used: 4 });

  assert.equal(quota.used, 4);
  assert.equal(quota.remaining, 11);
});
