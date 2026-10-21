'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const storage = require('../api/_lib/media-db');

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'MEDIA_STORAGE_KEY', 'MEDIA_STORAGE_BUCKET'];
function jsonResponse(status, value) {
  return { ok: status >= 200 && status < 300, status, async json() { return value; } };
}

test('V5 Storage readiness requires a readable private bucket and performs no writes', async () => {
  const previousEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
  const previousFetch = global.fetch;
  const calls = [];
  const responses = [
    jsonResponse(200, { id: 'classkru-v5-test', public: false }),
    jsonResponse(200, { id: 'classkru-v5-test', public: true }),
    jsonResponse(404, { message: 'Bucket not found' })
  ];
  try {
    process.env.SUPABASE_URL = 'https://supabase.test';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.MEDIA_STORAGE_KEY = 'a'.repeat(64);
    process.env.MEDIA_STORAGE_BUCKET = 'classkru-v5-test';
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return responses.shift();
    };

    assert.equal(await storage.checkBucket(), true);
    await assert.rejects(storage.checkBucket(), error => error.code === 'storage_bucket_unsafe');
    await assert.rejects(storage.checkBucket(), error => error.code === 'storage_bucket_unsafe');
    assert.equal(calls.length, 3);
    assert.ok(calls.every(({ url, options }) => url === 'https://supabase.test/storage/v1/bucket/classkru-v5-test' && options.method === 'GET' && options.body === undefined));
  } finally {
    global.fetch = previousFetch;
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  }
});
