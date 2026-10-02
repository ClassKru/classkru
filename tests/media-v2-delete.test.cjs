const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('V2 deletes one teacher work, its runs and runtime while preserving other works', async t => {
  const userId = crypto.randomUUID();
  const otherUserId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const anotherSessionId = crypto.randomUUID();
  const otherSessionId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const root = `users/${userId}/mini-lab-v2`;
  const otherRoot = `users/${otherUserId}/mini-lab-v2`;
  const objects = new Map([
    [`${root}/sessions/${sessionId}_index_1000_${crypto.randomUUID()}.json`, { id: sessionId, title: 'งานที่จะลบ', updated_at: '2026-10-02T00:00:00Z' }],
    [`${root}/messages/${sessionId}_message_${crypto.randomUUID()}.json`, { session_id: sessionId }],
    [`${root}/runs/${sessionId}_run_${runId}.json`, { id: runId, session_id: sessionId }],
    [`${root}/usage/${sessionId}_usage_${crypto.randomUUID()}.json`, { session_id: sessionId }],
    [`mini-lab-v2/runtime/${runId}.json`, { html: '<!doctype html>' }],
    [`${root}/sessions/${anotherSessionId}_index_1000_${crypto.randomUUID()}.json`, { id: anotherSessionId, title: 'งานอีกชิ้น', updated_at: '2026-10-02T00:00:00Z' }],
    [`${otherRoot}/sessions/${otherSessionId}_index_1000_${crypto.randomUUID()}.json`, { id: otherSessionId, title: 'งานของครูอีกคน', updated_at: '2026-10-02T00:00:00Z' }]
  ]);
  const storage = {
    configured: () => true,
    list: async (prefix, { search = '', offset = 0, limit = 1000 }) => [...objects.keys()]
      .filter(key => key.startsWith(`${prefix}/`)).map(key => ({ name: key.slice(prefix.length + 1), id: key }))
      .filter(row => row.name.includes(search)).slice(offset, offset + limit),
    documents: async (prefix, options) => (await storage.list(prefix, options)).map(row => objects.get(`${prefix}/${row.name}`)),
    get: async name => objects.get(name) || null,
    remove: async name => { objects.delete(name); }
  };
  const storagePath = require.resolve('../api/_lib/media-db');
  const userPath = require.resolve('../api/_lib/supabase-user');
  const handlerPath = require.resolve('../api/_lib/media-lab-v2-handler');
  const previous = new Map([storagePath, userPath, handlerPath].map(path => [path, require.cache[path]]));
  require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: storage };
  require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: { authenticatedUser: async () => ({ id: userId, email: 'teacher@example.test' }) } };
  delete require.cache[handlerPath];
  t.after(() => { for (const [path, cached] of previous) { if (cached) require.cache[path] = cached; else delete require.cache[path]; } });
  const handler = require('../api/_lib/media-lab-v2-handler');
  const call = async id => {
    const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    await handler({ method: 'DELETE', headers: { host: 'classkru.test', origin: 'https://classkru.test' }, query: { path: `sessions/${id}` } }, res);
    return res;
  };
  const result = await call(sessionId);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { deleted: true });
  assert.equal([...objects.keys()].some(key => key.includes(sessionId)), false);
  assert.equal(objects.has(`mini-lab-v2/runtime/${runId}.json`), false);
  assert.equal([...objects.keys()].some(key => key.includes(anotherSessionId)), true);
  assert.equal([...objects.keys()].some(key => key.includes(otherSessionId)), true);
  assert.equal((await call(sessionId)).statusCode, 404);
});
