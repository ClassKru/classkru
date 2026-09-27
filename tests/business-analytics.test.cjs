'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize, loadBusinessAnalytics, thaiDayStart } = require('../api/_lib/business-analytics');

test('business activity counts saved work, not eligible or merely registered accounts', () => {
  const now = new Date('2026-09-27T12:00:00.000Z');
  const result = summarize({
    teachers: [
      { teacher_id: 'a', email: 'a@example.test', subscription_status: 'trial', created_at: '2026-08-01T00:00:00Z' },
      { teacher_id: 'b', email: 'b@example.test', subscription_status: 'active', created_at: '2026-08-01T00:00:00Z' },
      { teacher_id: 'c', email: 'c@example.test', subscription_status: 'trial', created_at: '2026-09-27T08:00:00Z' }
    ],
    orders: [{ teacher_id: 'b', status: 'paid', amount_satang: 9900 }],
    classrooms: [
      { teacher_id: 'a', updated_at: '2026-08-10T00:00:00Z' },
      { teacher_id: 'b', updated_at: '2026-08-10T00:00:00Z' }
    ],
    attendance_records: [{ teacher_id: 'a', updated_at: '2026-09-27T08:00:00Z' }],
    score_items: []
  }, now);
  assert.equal(result.accounts.total, 3);
  assert.equal(result.accounts.eligible, 3);
  assert.equal(result.accounts.activated, 2);
  assert.equal(result.accounts.recordedToday, 1);
  assert.equal(result.accounts.recorded7d, 1);
  assert.equal(result.accounts.paid, 1);
  assert.equal(result.payments.paidAmountSatang, 9900);
  assert.equal(result.rows.find(row => row.teacherId === 'c').recorded7d, false);
});

test('Thai day boundary and paged cloud reads do not silently cap account counts', async () => {
  const now = new Date('2026-09-27T00:00:00.000Z');
  assert.equal(new Date(thaiDayStart(now)).toISOString(), '2026-09-26T17:00:00.000Z');
  const teachers = Array.from({ length: 1001 }, (_, i) => ({
    teacher_id: `teacher-${i}`, email: `user${i}@example.test`, subscription_status: 'trial', updated_at: '2026-09-01T00:00:00Z'
  }));
  const calls = [];
  const read = async (table, options) => {
    calls.push({ table, options });
    return table === 'teacher_profiles' ? teachers.slice(options.offset, options.offset + options.limit) : [];
  };
  const result = await loadBusinessAnalytics(now, read);
  assert.equal(result.accounts.total, 1001);
  assert.deepEqual(calls.filter(call => call.table === 'teacher_profiles').map(call => call.options.offset), [0, 1000]);
  assert.match(calls.find(call => call.table === 'attendance_records').options.filters.updated_at, /^gte\./);
});
