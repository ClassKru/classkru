'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { latestSucceededV5Job, mapV5TaskRows } = require('../api/_lib/developer-v2-media');

const teacherId = '11111111-1111-4111-8111-111111111111';
const firstJobId = '22222222-2222-4222-8222-222222222222';
const latestJobId = '33333333-3333-4333-8333-333333333333';
const artifactId = '44444444-4444-4444-8444-444444444444';

test('latestSucceededV5Job ignores failed jobs and selects the newest successful media', () => {
  const job = latestSucceededV5Job({ jobs: [
    { id: firstJobId, artifact_id: artifactId, state: 'succeeded', created_at: '2026-10-20T10:00:00.000Z' },
    { id: '55555555-5555-4555-8555-555555555555', artifact_id: artifactId, state: 'failed', created_at: '2026-10-21T10:00:00.000Z' },
    { id: latestJobId, artifact_id: artifactId, state: 'succeeded', created_at: '2026-10-22T10:00:00.000Z' }
  ] });
  assert.equal(job.id, latestJobId);
});
test('mapV5TaskRows returns one latest media row per V5 task with a protected preview URL', () => {
  const rows = mapV5TaskRows([{
    teacher_id: teacherId,
    id: '66666666-6666-4666-8666-666666666666',
    updated_at: '2026-10-22T10:01:00.000Z',
    state: {
      jobs: [{
        id: latestJobId,
        artifact_id: artifactId,
        state: 'succeeded',
        created_at: '2026-10-22T10:00:00.000Z',
        conversation_id: '77777777-7777-4777-8777-777777777777',
        specification: { media: { title: 'ระบบสุริยะจำลอง' } }
      }]
    }
  }], new Map([[teacherId, { teacher_id: teacherId, email: 'teacher@example.test' }]]));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'v5');
  assert.equal(rows[0].sourceLabel, 'ClassKru Studio V5');
  assert.equal(rows[0].teacher, 'teacher@example.test');
  assert.equal(rows[0].title, 'ระบบสุริยะจำลอง');
  assert.equal(rows[0].chat.available, false);
  assert.match(rows[0].runtimeUrl, /\/api\/dev\/data\?resource=studio-media-preview&/);
  assert.match(rows[0].runtimeUrl, /job_id=33333333-3333-4333-8333-333333333333/);
  assert.match(rows[0].runtimeUrl, /artifact_id=44444444-4444-4444-8444-444444444444/);
});
