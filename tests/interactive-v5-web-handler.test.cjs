'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createInteractiveV5Handler } = require('../api/_lib/interactive-v5/web-handler');

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
    send(value) { this.payload = value; return this; }
  };
}

function request(path, method = 'GET') { return { method, query: { path }, headers: {} }; }

test('V5 web gateway stays disabled until its explicit feature flag is enabled', async () => {
  let authenticated = false;
  const handler = createInteractiveV5Handler({ env: {}, authenticate: async () => { authenticated = true; return { id: 'teacher' }; } });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.payload, { error: 'interactive_v5_not_enabled' });
  assert.equal(authenticated, false);
});

test('V5 status requires an authenticated, same-origin request and reports server-side readiness only', async () => {
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true', OPENROUTER_API_KEY: 'server-key' },
    authenticate: async () => ({ id: 'teacher-id' }),
    originIsValid: () => true,
    checkDatabase: async () => true,
    storageIsReady: () => true
  });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, {
    mode: 'live', show_task_usage: false,
    conversation_configured: true, architect_configured: true, builder_configured: true,
    ai_configured: true, database_ready: true, storage_ready: true, ready: true
  });
});

test('V5 gateway rejects an invalid origin before accessing account data', async () => {
  let authenticated = false;
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true' },
    originIsValid: () => false,
    authenticate: async () => { authenticated = true; return { id: 'teacher-id' }; }
  });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { error: 'invalid_origin' });
  assert.equal(authenticated, false);
});

test('V5 status fails readiness when its Supabase migration is missing without exposing database details', async () => {
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true', OPENROUTER_API_KEY: 'server-key' },
    authenticate: async () => ({ id: 'teacher-id' }),
    originIsValid: () => true,
    checkDatabase: async () => { throw new Error('relation public.interactive_v5_tasks does not exist'); },
    storageIsReady: () => true
  });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.database_ready, false);
  assert.equal(res.payload.ready, false);
  assert.equal(JSON.stringify(res.payload).includes('does not exist'), false);
});

test('V5 status fails readiness when the configured Storage bucket is missing or unsafe without exposing details', async () => {
  const handler = createInteractiveV5Handler({
    env: { INTERACTIVE_V5_WEB_ENABLED: 'true', OPENROUTER_API_KEY: 'server-key' },
    authenticate: async () => ({ id: 'teacher-id' }),
    originIsValid: () => true,
    checkDatabase: async () => true,
    storageIsReady: async () => { throw Object.assign(new Error('private storage diagnostic'), { code: 'storage_bucket_unsafe' }); }
  });
  const res = response();
  await handler(request('status'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.storage_ready, false);
  assert.equal(res.payload.ready, false);
  assert.equal(JSON.stringify(res.payload).includes('private storage diagnostic'), false);
});
